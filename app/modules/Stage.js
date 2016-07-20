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
var Stats = require('../utils/Stats.js')

/*
* selectors
*/
class Stage {

  constructor() {

    this.clock = new THREE.Clock();
    this.speed = 50000;
    this.camPosIndexIncrease = 10;
    this.randomPoints = [];
    this.container = document.querySelector('#threeScene');
    this.overlay = document.querySelector('#overlay');
    this.songs = document.querySelector('#songs');
    this.tickTimer = 0;
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.changingColor = new THREE.Color(255, 255, 255);


  };

  /*
  * bring in audio and scene objects
  */
  init() {

    this.getAudio();
    this.createLayout();
    document.body.appendChild(this.stats.dom);

    this.loadSong('audio/happy.mp3');

    // this.songs.addEventListener('change', (e) => {

      

    // });
    this.animation = requestAnimationFrame(this.animate.bind(this));

    this.songs.addEventListener('change', this._onChange.bind(this));

    window.addEventListener('resize', this._onResize.bind(this));

    this._onResize();

  };

  /*
  * runs animations from update method
  */
  animate() {
    let time = Date.now();
    this.stats.begin();

    requestAnimationFrame(this.animate.bind(this));  
    this.update(time);
    this.stats.end();

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

    if (this.songBuffer) {

      let songDuration = this.songBuffer.duration;
      this.tickTimer++;
      this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / this.speed));

      if (this.audioTimer.getElapsedTime() >= (songDuration / 4)) {
        this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / 12500 ));
      }

      if (this.audioTimer.getElapsedTime() >= (songDuration / 3)) {
        this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / this.speed));
      }

      if (this.audioTimer.getElapsedTime() >= (songDuration / 2)) {
        this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / 30000 ));
      }

      if (this.audioTimer.getElapsedTime() >= (songDuration / 1.5)) {
        this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / this.speed ));
      }

      if ((this.tickTimer / 50) == parseInt((songDuration / 4), 10)) {
        this.visualMaterial.uniforms['texture2'].value = new THREE.TextureLoader().load("images/lavatile.jpg");  

      } else if ((this.tickTimer / 100) == parseInt((songDuration / 4), 10)) {
        this.visualMaterial.uniforms['texture2'].value = new THREE.TextureLoader().load("images/grassnormals.jpg");  

      } else if ((this.tickTimer / 100) == parseInt((songDuration / 3), 10)) {
        this.visualMaterial.uniforms['texture2'].value = new THREE.TextureLoader().load("images/waternormals.jpg"); 

      } else if ((this.tickTimer / 100) == parseInt((songDuration / 2), 10)) {
        this.visualMaterial.uniforms['texture2'].value = new THREE.TextureLoader().load("images/lavatile.jpg");  

      } else if ((this.tickTimer / 100) == parseInt((songDuration / 1.5), 10)) {
        this.visualMaterial.uniforms['texture2'].value = new THREE.TextureLoader().load("images/waternormals.jpg");      
      }
    }

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

    this.splineObjects.forEach((coin, index) => {
      let beat = (frequencyAverage / 1024) * index;

      coin.scale.x = Math.abs(frequencyArray[index] / 7500);
      coin.scale.y = Math.abs(frequencyArray[index] / 7500);
      coin.scale.z = Math.abs(frequencyArray[index] / 7500);

      coin.rotation.x = Date.now() * 0.0005;
      coin.rotation.y = Date.now() * 0.00025;

      //coin.material.color.setHex(0xfcfcfc);

      if (Math.abs(lowsArray[index] / 200) >= 0.25) {

        // TweenMax.to(coin.material.color, 0.15, {
        //   r: 212,
        //   g: 175,
        //   b: 55,
        //   ease: Power4.easeOut
        // });

        coin.material.color.setHex(0xd4af37);
        coin.material.opacity = 1;


      } else {

        // TweenMax.to(coin.material.color, 0.15, {
        //   r: 255,
        //   g: 255,
        //   b: 255,
        //   ease: Power4.easeOut
        // });

        coin.material.color.setHex(0xfcfcfc);
        coin.material.opacity = 0.35;

      };

    });

  };

  /*
  * audio frequency & volume data
  */
  getAudio() {
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.smoothingTimeConstant = 0.4;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.fftSize = 1024;

    this.sourceNode = this.context.createBufferSource();
    let splitter = this.context.createChannelSplitter();

    this.sourceNode.connect(splitter);

    splitter.connect(this.analyser, 0);

    this.sourceNode.connect(this.context.destination);

  };

  /*
  * load song
  */
  loadSong(song) {

    let request = new XMLHttpRequest();
    request.open('GET', song, true);
    request.responseType = 'arraybuffer';

    request.onload = () =>  {

      this.context.decodeAudioData(request.response).then((buffer) => {

        this.songBuffer = buffer;
        this.playSong(buffer);
        buffer.loop = true;

        TweenMax.to(document.querySelector('#overlay'), 0.5, {autoAlpha: 0, ease: Linear.easeOut});
        TweenMax.set(document.querySelector('#content'), {delay: 0.75, autoAlpha: 0});

      }).catch((err) => this._onError(err));

    };

    request.send();

  };

  /*
  * play song
  * @param {string} - song buffer
  */
  playSong(buffer) {

    let duration = buffer.duration;
    this.sourceNode.buffer = buffer;
    this.sourceNode.start(0);
    this.audioTimer = new THREE.Clock();
    this.audioTimer.start();
    this.sourceNode.loop = true;

  };

  /*
  * reset scene
  */
  redeax() {
    this.sourceNode.disconnect();

    window.cancelAnimationFrame(this.animation);

    this.scene.children.forEach( (object) => this.scene.remove(object) );
    this.container.removeChild(this.container.children[0]);

    this.context = null;
    this.analyzer = null;
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.updatedPath = [];
    this.randomPoints = [];
    this.splineObjects = [];
    this.tickTimer = 0;

    this.getAudio();
    this.createLayout();
  };


  /*
  * bring in three scene objects
  * create the scene
  */
  createLayout() {
    TweenMax.to(document.querySelector('#overlay'), 120, {scale: 2, ease: Linear.easeOut});

    this.renderer = new THREE.WebGLRenderer({alpha: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.z = 200;

    this.scene = new THREE.Scene();

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

    for ( let i = 0; i < 25; i ++ ) {
      this.randomPoints.push(new THREE.Vector3( (Math.random() * 200 - 100), (Math.random() * 200 - 100), (Math.random() * 200 - 100) ));
    }

    this.spline = new THREE.CatmullRomCurve3(this.randomPoints);

    this.camPosIndex = 0;

    this.getBg();
    this.getLights();
    this.getTubular();
    this.getParticles();

    this.container.appendChild(this.renderer.domElement);

    this.animate();
  };

  /*
  * cylinder objects maps the spine
  * plots points in spline as 'coins'
  * applies shaders
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

    // position objects(coins) along path of the spine
    var texture = new THREE.TextureLoader().load('images/coin.jpg');

    for (let i = 0; i < this.updatedPath.length; i++) {
      // let pointMesh = new THREE.Mesh(new THREE.TorusGeometry(10, 3, 16, 10), new THREE.MeshBasicMaterial({map: texture, transparent: true}));
      let pointMesh = new THREE.Mesh(new THREE.TorusGeometry(10, 3, 16, 10), new THREE.MeshBasicMaterial({color: '#ffffff', wireframe: true, transparent: true}));

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
      wireframe: true

    } );
    
    this.mesh = new THREE.Mesh(followGeometry, this.visualMaterial);

    this.scene.add(this.mesh);

  };

  /*
  * Shader Particle Engine (SPE)
  * https://github.com/squarefeet/ShaderParticleEngine
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
  * background sphere that surrounds scene
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

  _onChange() {
    TweenMax.set(document.querySelector('#overlay'), {scale: 1, autoAlpha: 1});

    if(this.songBuffer) {
      this.redeax();
    }

    switch(this.songs.value) {
      case 'mole':
        this.loadSong('audio/mole.mp3');

        break;
      case 'sasha':
        this.loadSong('audio/sasha.mp3');

        break;
      case 'wham':
        this.loadSong('audio/wham.mp3');

        break;
      case 'mistral':
        this.loadSong('audio/mistral.mp3');

        break;
      case 'happy':
        this.loadSong('audio/happy.mp3');

        break;
    }
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