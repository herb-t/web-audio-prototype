'use strict';

var THREE = require('three');

var CopyShader = require('../shaders/CopyShader.js');
var BrightnessShader = require('../shaders/BrightnessShader.js');

var EffectComposer = require('../utils/EffectComposer.js');
var RenderPass = require('../utils/RenderPass.js');
var FilmPass = require('../utils/FilmPass.js');
var BloomPass = require('../utils/BloomPass.js');
var MaskPass = require('../utils/MaskPass.js');
var ShaderPass = require('../utils/ShaderPass.js');

/*
* selectors
*/
var Stage = function() {
  
  this.renderer = new THREE.WebGLRenderer({alpha: true});
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  this.camera.position.z = 5;

  this.scene = new THREE.Scene();

  this.clock = new THREE.Clock();

  this.randomPoints = [];
  
  for ( var i = 0; i < 25; i ++ ) {
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
Stage.prototype.init = function() {

  this.getAudio();
  this.createLayout();

  this.composer = new THREE.EffectComposer(this.renderer);
  this.renderPass = new THREE.RenderPass(this.scene, this.camera)

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
Stage.prototype.animate = function() {
  var time = Date.now();

  requestAnimationFrame(this.animate.bind(this));  
  this.update(time);
  this.renderer.render(this.scene, this.camera);

};

/*
* handles anything that needs to be animated/updated
* updateVisual(), composer(shader), and orbit controls
*/
Stage.prototype.update = function(time) {
  var delta = 5 * this.clock.getDelta();
  var diff = time - this.lastTime;
  
  this.lastTime = time;

  if (!this.lastTime) {
    this.lastTime = time;
    
    return;
  }
  
  this.renderer.clear();
  this.composer.render();

  this.updateVisual();
  this.camPosIndex ++;
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
  
  this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / this.speed));

  this.sphere3.rotation.z = this.camRot.z;

};

/*
* animates/updates anything based on the audio data
*/
Stage.prototype.updateVisual = function() {
  var lowsArray = new Uint8Array(this.analyser.frequencyBinCount);
  var frequencyArray = new Float32Array(this.analyser.frequencyBinCount);
  
  this.analyser.getByteFrequencyData(lowsArray);
  this.analyser.getFloatFrequencyData(frequencyArray);
  
  var average = this._getAverageVolume(lowsArray);
  var frequencyAverage = this._getAverageVolume(frequencyArray);

  // split the array
  var section = 0;
  var sliceSize = lowsArray.length/2;

  for(var s = 0; s < 2; s++) {
    var totalSlice = 0;

    for ( var i = section; i < (sliceSize*(s+1)); i++ ) {
      var value = lowsArray[i];
      totalSlice += value;
      
      section = i;
    }

    totalSlice = totalSlice/sliceSize;
  }

  // light flash effects based on highs and lows
  this.brightnessEffect.uniforms['amount'].value = Math.abs(frequencyAverage / 100);

  // do something based on highs and lows
  if (average > 80) {
    this.sphere1.scale.y = frequencyAverage / 60;
    this.sphere1.scale.x = frequencyAverage / 60;
    this.sphere1.scale.z = frequencyAverage / 60;
  } else {
    this.sphere2.scale.y = frequencyAverage / 60;
    this.sphere2.scale.x = frequencyAverage / 60;
    this.sphere2.scale.z = frequencyAverage / 60;  
  };

  // visual equalizer boxes
  this.boxes.forEach(function(box, index) {
    box.scale.x = Math.abs(frequencyArray[index] / 100);
    box.scale.y = Math.abs(frequencyArray[index] / 100);
    box.scale.z = Math.abs(frequencyArray[index] / 100);

    box.rotation.x = Date.now() * 0.0005;
    box.rotation.y = Date.now() * 0.00025;
  });

};

/*
* WebAudio API frequency & volume data
* loads & plays audio
* create sound 'bars' for equlizer
*/
Stage.prototype.getAudio = function() {
  var context = new AudioContext();
  var offlineContext = new OfflineAudioContext(1, 512, 3000);

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

  var sourceNode = context.createBufferSource();
  var offlineSource = offlineContext.createBufferSource();
  var splitter = context.createChannelSplitter();

  sourceNode.connect(splitter);

  splitter.connect(this.analyser, 0);
  splitter.connect(this.analyser2, 1);

  sourceNode.connect(context.destination);
  offlineSource.connect(this.filter);
  this.filter.connect(offlineContext.destination);

  var request = new XMLHttpRequest();
  request.open('GET', 'audio/mole.mp3', true);
  request.responseType = 'arraybuffer';

  var songBuffer;
  
  // load audio and play it
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      songBuffer = buffer;

      var dur = buffer.duration;

      sourceNode.buffer = buffer;
      sourceNode.start(0);
      sourceNode.loop = true;

      // audio data run through low pass filter
      offlineContext.startRendering().then(function(renderedBuffer) {
        console.log('Rendering completed successfully');
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var song = audioCtx.createBufferSource();
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
Stage.prototype.createLayout = function() {
  this.getBoxes();
  this.getSpheres();
  this.getBg();
  this.getLights();
  this.getTubular();
};

/*
* two sphere objects
*/
Stage.prototype.getSpheres = function() {

  var sphereGeometry = new THREE.SphereGeometry(10, 32, 32);
  var sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xa21c1c, wireframe: true, transparent: true } );
  
  // this.sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
  this.sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
  this.sphere1.name = 'sphere1';
  this.scene.add(this.sphere1);

  this.sphere2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
  this.sphere2.name = 'sphere2';
  this.sphere2.position.x = 150;
  this.scene.add(this.sphere2);
};

/*
* wireframe box objects
*/
Stage.prototype.getBoxes = function () {
  this.boxes = [];
  this.colors = ['#000080', '#19198c', "#323299", '#4c4ca6', '#6666b2', '#7f7fbf', '#9999cc', '#b2b2d8', '#cccce5', '#e5e5f2', '#ffffff'];

  for (var i = 0; i < 400; i++) {
    this.box = new THREE.Mesh(
      new THREE.BoxGeometry(5,5,5),
      // new THREE.MeshBasicMaterial({color: '#' + Math.floor(Math.random() * 16777215).toString(16), wireframe: true})
      new THREE.MeshBasicMaterial({color: this.colors[Math.floor(Math.random() * (this.colors.length - 1) + 1)], wireframe: true})
    );

    this.boxes.push(this.box);
    
    this.box.position.x = -300 + Math.random() * 600;
    this.box.position.y = -300 + Math.random() * 600;  
    this.box.position.z = -300 + Math.random() * 600;

    this.box.rotation.x = -300 + Math.random() * 600;
    this.box.rotation.y = -300 + Math.random() * 600;  
    
    this.scene.add(this.box);
  }
};

/*
* cylinder objects maps the spine
*/
Stage.prototype.getTubular = function() {
  var step = 0;
  this.updatedPath = [];

  for (var i = 0; i < 1000; i++) {
    var r = 1 / 1000;
    step += r;
    this.updatedPath.push(this.spline.getPoint(step));
  };

  this.tubeSize = 16;
  var followGeometry =  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.updatedPath), this.updatedPath.length, 2, this.tubeSize);
  this.mesh = new THREE.Mesh(followGeometry, new THREE.MeshBasicMaterial({color: '#00ffff', wireframe: true, opacity: 0.3}));
  this.scene.add(this.mesh);

};

/*
* three sphere that surrounds scene
*/
Stage.prototype.getBg = function() {
  var geometry = new THREE.SphereGeometry(600, 32, 32);
  var texture = new THREE.TextureLoader().load('images/bg-stars.jpg');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  this.bgMesh = new THREE.Mesh(geometry, material);

  this.scene.add(this.bgMesh);
};

/*
* spotlight attacthed to camera
*/
Stage.prototype.getLights = function() {
  var spotLight = new THREE.SpotLight(0xffffff, 1, 200, 20, 10);
  spotLight.position.set( 0, 150, 0 );
    
  var spotTarget = new THREE.Object3D();
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
Stage.prototype._getAverageVolume = function(array) {
  var values = 0;
  var average;
  var length = array.length;

  for (var i = 0; i < length; i++) {
    values += array[i];
  }

  average = values / length;

  return average;
};

/*
* handles browser resize
*/
Stage.prototype._onResize = function() {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  
  this.renderer.setSize( window.innerWidth, window.innerHeight );
};

/*
* gives error message if problems retrieving audio
* @param {String} e
*/
Stage.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Stage;