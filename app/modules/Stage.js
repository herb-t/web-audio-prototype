'use strict';

var uniforms;

var THREE = require('three');

var OrbitControls = require('../utils/OrbitControls.js');

var CopyShader = require('../shaders/CopyShader.js');
var FilmShader = require('../shaders/FilmShader.js');
var ConvolutionShader = require('../shaders/ConvolutionShader.js');
var BadTv = require('../shaders/BadTv.js');

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

  this.camera = new THREE.PerspectiveCamera(35, ((window.innerWidth / 2) / (window.innerHeight / 2)), 1, 3000);
  this.camera.position.z = 4;

  this.scene = new THREE.Scene();

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.autoRotate = true;

};

/*
* get/start audio, add shape mesh and particles
* add custom shader effects and define uniforms
*/
Stage.prototype.init = function() {

  this.getAudio();
  this.getParticles();

  this.renderModel = new THREE.RenderPass(this.scene, this.camera);
  this.effectBloom = new THREE.BloomPass(1.25);
  this.effectFilm = new THREE.FilmPass(0.35, 0.95, 2048, false);

  this.effectFilm.renderToScreen = true;

  this.composer = new THREE.EffectComposer(this.renderer);

  this.composer.addPass(this.renderModel);
  this.composer.addPass(this.effectBloom);
  this.composer.addPass(this.effectFilm);

  this.badTVEffect = new THREE.ShaderPass(THREE.BadTVShader);
  this.badTVEffect.uniforms['speed'].value = 10;
  this.badTVEffect.uniforms['rollSpeed'].value = 20;
  this.composer.addPass(this.badTVEffect);

  this.clock = new THREE.Clock();

  uniforms = {

    fogDensity: {value: 0.1},
    fogColor:   {value: new THREE.Vector3(0, 0, 0)},
    time:       {value: 1.0},
    resolution: {value: new THREE.Vector2()},
    uvScale:    {value: new THREE.Vector2( 3.0, 1.0)},
    texture1:   {value: new THREE.TextureLoader().load("images/cloud.png")},
    texture2:   {value: new THREE.TextureLoader().load("images/lavatile.jpg")}

  };

  uniforms.texture1.value.wrapS = uniforms.texture1.value.wrapT = THREE.RepeatWrapping;
  uniforms.texture2.value.wrapS = uniforms.texture2.value.wrapT = THREE.RepeatWrapping;

  var size = 0.65;

  this.visualMaterial = new THREE.ShaderMaterial( {

    uniforms: uniforms,
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('fragmentShader').textContent

  } );

  this.visualMesh = new THREE.Mesh( new THREE.TorusGeometry(size, 0.3, 30, 30), this.visualMaterial);
  this.visualMesh.rotation.x = 0.3;
  this.scene.add(this.visualMesh);

  document.body.appendChild(this.renderer.domElement);
  this.renderer.autoClear = false;

  // background spin animation
  TweenMax.to(document.querySelector('#bg'), 2000, {
    rotation: -1080,
    yoyo: true,
    repeat: -1,
    ease: Power1.easeOut
  });

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

  this.visualMesh.rotation.y += 0.0125 * delta;
  this.visualMesh.rotation.x += 0.05 * delta;

  this.particleSystem.rotation.y += 0.01 * delta;
  
  this.renderer.clear();
  this.composer.render(0.1);

  this.controls.update()

  this.updateVisual();

};

/*
* animates/updates anything based on the audio data
*/
Stage.prototype.updateVisual = function() {
  var array = new Uint8Array(this.analyser.frequencyBinCount);
  var frequencyArray = new Float32Array(this.analyser.frequencyBinCount);
  
  this.analyser.getByteFrequencyData(array);
  this.analyser.getFloatFrequencyData(frequencyArray);
  
  var average = this._getAverageVolume(array);
  var frequencyAverage = this._getAverageVolume(frequencyArray);

  // update shader uniforms
  this.visualMaterial.uniforms['fogDensity'].value = frequencyAverage / 200;
  this.visualMaterial.uniforms['time'].value = average / 50;

  // visual equalizer bars
  this.barsArray.forEach(function(bar, index) {
    bar.style.height = Math.abs(frequencyArray[index]) + 'px';
    bar.style.backgroundColor = '#' + (Math.abs(frequencyArray[index]) * 10000);
  });

  this.particleSystem.scale.y = average / 5000;

};

/*
* WebAudio API frequency & volume data
* loads & plays audio
* create sound 'bars' for equlizer
*/
Stage.prototype.getAudio = function() {
  var context = new AudioContext();
  this.analyser = context.createAnalyser();
  this.analyser.smoothingTimeConstant = 0.4;
  this.analyser.fftSize = 1024;

  this.analyser2 = context.createAnalyser();
  this.analyser2.smoothingTimeConstant = 0.4;
  this.analyser2.fftSize = 1024;

  this.barsAnalyser = context.createAnalyser();
  this.barsAnalyser.fftSize = 64;

  var sourceNode = context.createBufferSource();
  var splitter = context.createChannelSplitter();

  sourceNode.connect(splitter);

  splitter.connect(this.analyser, 0);
  splitter.connect(this.analyser2, 1);

  sourceNode.connect(context.destination);

  var request = new XMLHttpRequest();
  request.open('GET', 'audio/sasha.mp3', true);
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

    }, this._onError);
  };

  request.send();

  this.soundBars();
};

/*
* creates sound bars based on frequncy data
*/
Stage.prototype.soundBars = function() {

  this.soundBars = document.querySelector('#soundBars');

  this.barsArray = [];
  
  for (var i = 0; i < this.barsAnalyser.frequencyBinCount; i++) {

    this.newBars = document.createElement('div');
    this.soundBars.appendChild(this.newBars);
    this.barsArray.push(this.newBars);

  };

};

/*
* creates particles and positions them randomly around shape mesh
*/
Stage.prototype.getParticles = function() {

  this.count = 600;
  this.particles = new THREE.Geometry();
  var pMaterial = new THREE.PointsMaterial({
    color: 0xf1f1f1,
    size: 1,
    map: new THREE.TextureLoader().load('images/eye.png'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.85
  });

  for (var p = 0; p < this.count; p++) {
    var pX = Math.random() * 100 - 50;
    var pY = Math.random() * 100 - 50;
    var pZ = Math.random() * 100 - 50;

    this.particle = new THREE.Vector3(pX, pY, pZ);
    this.particle.velocity = new THREE.Vector3(0, -Math.random(), 0);  

    this.particles.vertices.push(this.particle);

  }

  this.particleSystem = new THREE.Points(this.particles, pMaterial);
  this.particleSystem.sortParticles = true;

  this.scene.add(this.particleSystem);

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
  
  this.composer.setSize( window.innerWidth, window.innerHeight );
  this.composer.reset();

  uniforms.resolution.value.x = window.innerWidth;
  uniforms.resolution.value.y = window.innerHeight;
};

/*
* gives error message if problems retrieving audio
* @param {String} e
*/
Stage.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Stage;