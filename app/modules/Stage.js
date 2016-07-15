'use strict';

const THREE = require('three');

const CopyShader = require('../shaders/CopyShader.js');
const FilmShader = require('../shaders/FilmShader.js');
const BrightnessShader = require('../shaders/BrightnessShader.js');
const ConvolutionShader = require('../shaders/ConvolutionShader.js');

const EffectComposer = require('../utils/EffectComposer.js');
const RenderPass = require('../utils/RenderPass.js');
const FilmPass = require('../utils/FilmPass.js');
const BloomPass = require('../utils/BloomPass.js');
const MaskPass = require('../utils/MaskPass.js');
const ShaderPass = require('../utils/ShaderPass.js');
const SPE = require('../utils/SPE.js');

/*
* selectors
*/
class Stage {

  constructor() {
  
    this.renderer = new THREE.WebGLRenderer({alpha: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.z = 200;

    this.scene = new THREE.Scene();

    this.clock = new THREE.Clock();

    this.randomPoints = [];
    
    for ( let i = 0; i < 25; i ++ ) {
      this.randomPoints.push(new THREE.Vector3( (Math.random() * 200 - 100), (Math.random() * 200 - 100), (Math.random() * 200 - 100) ));
    }

    this.spline = new THREE.CatmullRomCurve3(this.randomPoints);

    this.camPosIndex = 0;

    this.overlay = document.querySelector('#overlay');

    TweenMax.to(document.querySelector('#overlay'), 120, {scale: 2, ease: Linear.easeOut});
  };

  /*
  * bring in audio and scene objects
  */
  init() {

    this.getAudio();
    this.createLayout();
    this.getParticles();

    this.composer = new THREE.EffectComposer(this.renderer);
    this.renderPass = new THREE.RenderPass(this.scene, this.camera)

    this.effectBloom = new THREE.BloomPass(1.25);
    this.effectFilm = new THREE.FilmPass(0.35, 0.95, 2048, false);

    this.effectFilm.renderToScreen = true;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.effectBloom);
    this.composer.addPass(this.effectFilm);

    this.brightnessEffect = new THREE.ShaderPass(THREE.BrightnessShader);
    this.brightnessEffect.uniforms['amount'].value = 0.1;
    this.brightnessEffect.renderToScreen = true;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.brightnessEffect);
    
    document.body.appendChild(this.renderer.domElement);

    requestAnimationFrame(this.animate.bind(this));

    window.addEventListener('resize', this._onResize.bind(this));

    this._onResize();

  };

  /*
  * runs animations from update method
  */
  animate() {
    let time = Date.now();

    requestAnimationFrame(this.animate.bind(this));  
    this.update(time);
    this.renderer.render(this.scene, this.camera);

  };

  /*
  * handles anything that needs to be animated/updated
  * updateVisual(), composer(shader), and orbit controls
  */
  update(time) {
    let delta = 5 * this.clock.getDelta();
    let diff = time - this.lastTime;
    
    this.lastTime = time;

    if (!this.lastTime) {
      this.lastTime = time;
      
      return;
    }
    
    this.renderer.clear();
    this.composer.render();

    this.updateVisual();
    this.camPosIndex ++;
    this.endPosIndex --;

    this.speed = 25000;
    
    if (this.camPosIndex > this.speed) {
      this.camPosIndex = 0;
    }
    
    this.camPos = this.spline.getPoint(this.camPosIndex / this.speed);
    this.camRot = this.spline.getTangent(this.camPosIndex / this.speed)

    this.camera.position.x = this.camPos.x;
    this.camera.position.y = this.camPos.y;
    this.camera.position.z = this.camPos.z;
    
    this.camera.rotation.x = this.camRot.x;
    this.camera.rotation.y = this.camRot.y;
    this.camera.rotation.z = this.camRot.z;
    
    this.particleGroup.tick(this.clock.getDelta());
    
    this.particleGroup.mesh.position.x = this.camPos.x + 10;
    this.particleGroup.mesh.position.y = this.camPos.y + 10;
    this.particleGroup.mesh.position.z = this.camPos.z + 10;
    
    this.particleGroup.mesh.rotation.x = this.camRot.x;
    this.particleGroup.mesh.rotation.y = this.camRot.y;
    this.particleGroup.mesh.rotation.z = this.camRot.z;

    this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / this.speed));

    //this.sphere3.rotation.z = this.camRot.z;

  };



  /*
  * animates/updates anything based on the audio data
  */
  updateVisual() {
    let lowsArray = new Uint8Array(this.analyser.frequencyBinCount);
    let frequencyArray = new Float32Array(this.analyser.frequencyBinCount);
    
    this.analyser.getByteFrequencyData(lowsArray);
    this.analyser.getFloatFrequencyData(frequencyArray);
    
    let average = this._getAverageVolume(lowsArray);
    let frequencyAverage = this._getAverageVolume(frequencyArray);

    // light flash effects based on highs and lows
    this.brightnessEffect.uniforms['amount'].value = Math.abs(frequencyAverage / 100);

    // uniforms update off audio data
    this.visualMaterial.uniforms['fogDensity'].value = frequencyAverage / 350;
    this.visualMaterial.uniforms['time'].value = frequencyAverage / 50;

    this.splineObjects.forEach(function(coin, index) {
      coin.scale.x = Math.abs(frequencyArray[index] / 7500);
      coin.scale.y = Math.abs(frequencyArray[index] / 7500);
      coin.scale.z = Math.abs(frequencyArray[index] / 7500);

      coin.rotation.x = Date.now() * 0.0005;
      coin.rotation.y = Date.now() * 0.00025;

      coin.material.opacity = Math.abs(lowsArray[index] / 200);
    });

  };

  /*
  * WebAudio API frequency & volume data
  * loads & plays audio
  * create sound 'bars' for equlizer
  */
  getAudio() {
    let context = new AudioContext();
    let offlineContext = new OfflineAudioContext(1, 512, 3000);

    this.analyser = context.createAnalyser();
    this.analyser.smoothingTimeConstant = 0.4;
    this.analyser.fftSize = 1024;

    this.analyser2 = context.createAnalyser();
    this.analyser2.smoothingTimeConstant = 0.4;
    this.analyser2.fftSize = 1024;

    this.bassAnalyser = context.createAnalyser();
    this.bassAnalyser.fftSize = 64;

    // low pass filter (lows)
    this.filter = offlineContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 5000;
    this.filter.gain.value = 25;

    let sourceNode = context.createBufferSource();
    let offlineSource = offlineContext.createBufferSource();
    let splitter = context.createChannelSplitter();

    sourceNode.connect(splitter);

    splitter.connect(this.analyser, 0);
    splitter.connect(this.analyser2, 1);

    sourceNode.connect(context.destination);
    offlineSource.connect(this.filter);
    this.filter.connect(offlineContext.destination);

    let request = new XMLHttpRequest();
    request.open('GET', 'audio/mole.mp3', true);
    request.responseType = 'arraybuffer';

    let songBuffer;
    
    // load audio and play it
    request.onload = function() {
      context.decodeAudioData(request.response, function(buffer) {
        songBuffer = buffer;

        let dur = buffer.duration;

        sourceNode.buffer = buffer;
        sourceNode.start(0);
        sourceNode.loop = true;

        // audio data run through low pass filter
        offlineContext.startRendering().then(function(renderedBuffer) {
          console.log('Rendering completed successfully');
          let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          let song = audioCtx.createBufferSource();
          song.buffer = renderedBuffer;

          song.connect(audioCtx.destination);

          offlineSource.connect(offlineContext.destination);

          song.start();
          TweenMax.to(document.querySelector('#overlay'), 0.5, {autoAlpha: 0, ease: Linear.easeOut});

        }).catch(function(err) {
            console.log('Rendering failed: ' + err);
        });

      }, this._onError);
    };

    request.send();

  };

  /*
  * bring in three.js stuff
  */
  createLayout() {
    // this.getBoxes();
    // this.getSpheres();
    this.getBg();
    this.getLights();
    this.getTubular();
  };

  /*
  * two sphere objects
  */
  getSpheres() {

    let sphereGeometry = new THREE.SphereGeometry(10, 32, 32);
    let sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xa21c1c, wireframe: true, transparent: true } );
    
    this.sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.sphere1.name = 'sphere1';
    this.scene.add(this.sphere1);

    // this.sphere2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    // this.sphere2.name = 'sphere2';
    // this.sphere2.position.x = 150;
    // this.scene.add(this.sphere2);
  };

  /*
  * wireframe box objects
  */
  getBoxes() {
    this.boxes = [];
    this.colors = ['#000080', '#19198c', "#323299", '#4c4ca6', '#6666b2', '#7f7fbf', '#9999cc', '#b2b2d8', '#cccce5', '#e5e5f2', '#ffffff'];

    for (let i = 0; i < 400; i++) {
      this.box = new THREE.Mesh(
        new THREE.BoxGeometry(5,5,5),
        // new THREE.MeshBasicMaterial({color: '#' + Math.floor(Math.random() * 16777215).toString(16), wireframe: true})
        new THREE.MeshBasicMaterial({color: this.colors[Math.floor(Math.random() * (this.colors.length - 1) + 1)], wireframe: true})
      );

      this.boxes.push(this.box);

      this.box.position.x = -300 + Math.random() * 600;
      this.box.position.y = -300 + Math.random() * 600;  
      this.box.position.z = -300 + Math.random() * 600;

      this.box.rotation.x = (Math.random() * (Math.PI * 4 - 0) + 0);
      this.box.rotation.y = (Math.random() * (Math.PI * 4 - 0) + 0);
      this.box.rotation.z = (Math.random() * (Math.PI * 4 - 0) + 0);
      
      this.scene.add(this.box);
    }
  };

  /*
  * cylinder objects maps the spine
  */
  getTubular() {
    let step = 0;
    this.updatedPath = [];
    this.splineObjects = [];
    
    for (let i = 0; i < 500; i++) {
      let r = 1 / 500;
      step += r;
      this.updatedPath.push(this.spline.getPoint(step));
    };

    // position objects along path of the spine
    var texture = new THREE.TextureLoader().load('images/coin.jpg');

    for (let i = 0; i < this.updatedPath.length; i++) {
      let pointMesh = new THREE.Mesh(new THREE.TorusGeometry(10, 3, 16, 10), new THREE.MeshBasicMaterial({map: texture, transparent: true}));

      pointMesh.position.x = this.updatedPath[i].x + (Math.random() * 1.5);
      pointMesh.position.y = this.updatedPath[i].y + (Math.random() * 1.5);
      pointMesh.position.z = this.updatedPath[i].z + (Math.random() * 1.5);

      pointMesh.rotation.x = (Math.random() * (Math.PI ));
      pointMesh.rotation.y = (Math.random() * (Math.PI ));
      pointMesh.rotation.z = (Math.random() * (Math.PI ));

      pointMesh.scale.x = 0.025;
      pointMesh.scale.y = 0.025;
      pointMesh.scale.z = 0.025;

      this.scene.add(pointMesh);

      this.splineObjects.push(pointMesh);
    };

    this.tubeSize = 500;
    let followGeometry =  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.updatedPath), this.updatedPath.length, 2, this.tubeSize);

    this.uniforms = {

      fogDensity: {value: 0.1},
      fogColor:   {value: new THREE.Vector3(0, 0, 0)},
      time:       {value: 1.0},
      resolution: {value: new THREE.Vector2()},
      uvScale:    {value: new THREE.Vector2( 3.0, 1.0)},
      texture1:   {value: new THREE.TextureLoader().load("images/cloud.png")},
      texture2:   {value: new THREE.TextureLoader().load("images/waternormals.jpg")}

    };

    this.uniforms.texture1.value.wrapS = this.uniforms.texture1.value.wrapT = THREE.RepeatWrapping;
    this.uniforms.texture2.value.wrapS = this.uniforms.texture2.value.wrapT = THREE.RepeatWrapping;

    this.visualMaterial = new THREE.ShaderMaterial( {

      uniforms: this.uniforms,
      vertexShader: document.getElementById('vertexShader').textContent,
      fragmentShader: document.getElementById('fragmentShader').textContent,
      wireframe: true,
      transparent: true,
      opacity: 0.5

    } );
    
    this.mesh = new THREE.Mesh(followGeometry, this.visualMaterial);

    this.scene.add(this.mesh);

  };

  /*
  * Shader Particle Engine (SPE)
  */
  getParticles() {
    this.particleGroup = new SPE.Group({
      texture: {
        value: new THREE.TextureLoader().load('images/dot.png')
      }
    });

    this.emitter = new SPE.Emitter({
      maxAge: {
        value: 2
      },

      position: {
        value: new THREE.Vector3(0, 0, -50),
        spread: new THREE.Vector3( 0, 0, 0 )
      },

      acceleration: {
        value: new THREE.Vector3(0, -10, 0),
        spread: new THREE.Vector3( 10, 0, 10 )
      },

      velocity: {
        value: new THREE.Vector3(0, 25, 0),
        spread: new THREE.Vector3(10, 7.5, 10)
      },

      color: {
        value: [ new THREE.Color('white'), new THREE.Color('red') ]
      },

      size: {
        value: 1
      },

      particleCount: 2000,

      maxParticleCount: 2000
    });

    this.particleGroup.addEmitter(this.emitter);
    this.scene.add( this.particleGroup.mesh );
  }

  /*
  * three sphere that surrounds scene
  */
  getBg() {
    let geometry = new THREE.SphereGeometry(600, 32, 32);
    var texture = new THREE.TextureLoader().load('images/bg-stars.jpg');

    let material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });

    this.bgMesh = new THREE.Mesh(geometry, material);

    this.scene.add(this.bgMesh);
  };

  /*
  * spotlight attacthed to camera
  */
  getLights() {
    let spotLight = new THREE.SpotLight(0xffffff, 1, 200, 20, 10);
    spotLight.position.set( 0, 150, 0 );
      
    let spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    spotLight.target = spotTarget;
      
    this.camera.add(spotLight);
    this.camera.add(new THREE.PointLightHelper(spotLight, 1));
  };

  /*
  * gets average from array
  * @param {Array} array
  * @return {Number} average
  */
  _getAverageVolume(array) {
    let values = 0;
    let average;
    let length = array.length;

    for (let i = 0; i < length; i++) {
      values += array[i];
    }

    average = values / length;

    return average;
  };

  /*
  * handles browser resize
  */
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize( window.innerWidth, window.innerHeight );

    this.composer.setSize( window.innerWidth, window.innerHeight );
    this.composer.reset();

    this.uniforms.resolution.value.x = window.innerWidth;
    this.uniforms.resolution.value.y = window.innerHeight;
  };

  /*
  * gives error message if problems retrieving audio
  * @param {String} e
  */
  _onError(e) {
    console.log(e);
  };

};

module.exports = Stage;