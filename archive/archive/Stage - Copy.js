'use strict';

var uniforms;

var THREE = require('three');

var OrbitControls = require('../libs/OrbitControls.js');

var CopyShader = require('../shaders/CopyShader.js');
var FilmShader = require('../shaders/FilmShader.js');
var ConvolutionShader = require('../shaders/ConvolutionShader.js');
var BadTv = require('../shaders/BadTv.js');

var EffectComposer = require('../libs/EffectComposer.js');
var RenderPass = require('../libs/RenderPass.js');
var FilmPass = require('../libs/FilmPass.js');
var BloomPass = require('../libs/BloomPass.js');
var MaskPass = require('../libs/MaskPass.js');
var ShaderPass = require('../libs/ShaderPass.js');

var Stage = function() {
  
  this.renderer = new THREE.WebGLRenderer({alpha: true});
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  // document.body.appendChild(this.renderer.domElement);

  this.camera = new THREE.PerspectiveCamera(35, ((window.innerWidth / 2) / (window.innerHeight / 2)), 1, 3000);
  this.camera.position.z = 4;

  this.scene = new THREE.Scene();

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.autoRotate = true;

  this.visualElement;

};

Stage.prototype.init = function() {

  this.getAudio();

  requestAnimationFrame(this.animate.bind(this));

  // on resize
  window.addEventListener('resize', this._onResize.bind(this));

  TweenMax.to(document.querySelector('.bg'), 2000, {
    rotation: -1080,
    yoyo: true,
    repeat: -1,
    ease: Power1.easeOut
  });

  this.renderModel = new THREE.RenderPass( this.scene, this.camera );
  this.effectBloom = new THREE.BloomPass( 1.25 );
  this.effectFilm = new THREE.FilmPass( 0.35, 0.95, 2048, false );

  this.effectFilm.renderToScreen = true;

  this.composer = new THREE.EffectComposer( this.renderer );

  this.composer.addPass(this.renderModel);
  this.composer.addPass(this.effectBloom);
  this.composer.addPass(this.effectFilm);

  this.badTVEffect = new THREE.ShaderPass(THREE.BadTVShader);
  this.badTVEffect.uniforms['speed'].value = 10;
  this.badTVEffect.uniforms['rollSpeed'].value = 20;
  // this.badTVEffect.renderToScreen = true;
  this.composer.addPass(this.badTVEffect);

  this.clock = new THREE.Clock();

  uniforms = {

    fogDensity: { value: 0.1 },
    fogColor:   { value: new THREE.Vector3( 0, 0, 0 ) },
    time:       { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
    uvScale:    { value: new THREE.Vector2( 3.0, 1.0 ) },
    texture1:   { value: new THREE.TextureLoader().load( "images/cloud.png" ) },
    texture2:   { value: new THREE.TextureLoader().load( "images/lavatile.jpg" ) }

  };

  uniforms.texture1.value.wrapS = uniforms.texture1.value.wrapT = THREE.RepeatWrapping;
  uniforms.texture2.value.wrapS = uniforms.texture2.value.wrapT = THREE.RepeatWrapping;

  var size = 0.65;

  this.visualMaterial = new THREE.ShaderMaterial( {

    uniforms: uniforms,
    vertexShader: document.getElementById( 'vertexShader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentShader' ).textContent

  } );

  this.visualMesh = new THREE.Mesh( new THREE.TorusGeometry( size, 0.3, 30, 30 ), this.visualMaterial);
  this.visualMesh.rotation.x = 0.3;
  this.scene.add(this.visualMesh);

  this.renderer = new THREE.WebGLRenderer({antialias: true});
  this.renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(this.renderer.domElement);
  this.renderer.autoClear = false;

  var frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

   for (var i = 0; i < frequencyData.length; i++) {
    console.log(frequencyData[i]);
  };

  this._onResize();
};

Stage.prototype.animate = function() {
  requestAnimationFrame(this.animate.bind(this));
  var time = Date.now();

  this.update(time);

  this.renderer.render(this.scene, this.camera);

};

Stage.prototype.update = function(time) {
  var diff = time - this.lastTime;
  this.lastTime = time;

  if (!this.lastTime) {
    this.lastTime = time;
    
    return;
  }  

  // this.object.rotation.x += 0.0025;
  // this.object.rotation.y += 0.001;
  //this.partSystem.rotation.y = time * 0.0005;

  var delta = 5 * this.clock.getDelta();

  // uniforms.time.value += 0.2 * delta;
  // this.visualMaterial.uniforms['time'].value += 0.2 * delta;

  this.visualMesh.rotation.y += 0.0125 * delta;
  this.visualMesh.rotation.x += 0.05 * delta;

  this.renderer.clear();
  this.composer.render(0.1);

  this.controls.update()

  this.updateVisual();

};

Stage.prototype.updateVisual = function() {
  var array = new Uint8Array(this.analyser.frequencyBinCount);
  var frequencyArray = new Float32Array(this.analyser.frequencyBinCount);
  this.analyser.getByteFrequencyData(array);
  this.analyser.getFloatFrequencyData(frequencyArray);
  var average = this._getAverageVolume(array);
  var frequencyAverage = this._getAverageVolume(frequencyArray);

  this.visualMaterial.uniforms['fogDensity'].value = frequencyAverage / 200;
  this.visualMaterial.uniforms['time'].value = average / 50;

  // for (var i = 0; i < frequencyArray.length; i++) {
  //   console.log(frequencyArray[i]);
  // };

};

Stage.prototype.getAudio = function() {
  var context = new AudioContext();
  this.analyser = context.createAnalyser();
  this.analyser.smoothingTimeConstant = 0.4;
  this.analyser.fftSize = 1024;

  this.analyser2 = context.createAnalyser();
  this.analyser2.smoothingTimeConstant = 0.4;
  this.analyser2.fftSize = 1024;

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
  
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      songBuffer = buffer;

      var dur = buffer.duration;

      sourceNode.buffer = buffer;
      sourceNode.start(0);
      sourceNode.loop = true;
      sourceNode.muted = true;

    }, this._onError);
  }.bind(this);

  request.send();
};

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

Stage.prototype._onResize = function() {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  
  this.renderer.setSize( window.innerWidth, window.innerHeight );
  
  this.composer.setSize( window.innerWidth, window.innerHeight );
  this.composer.reset();

  uniforms.resolution.value.x = window.innerWidth;
  uniforms.resolution.value.y = window.innerHeight;
};

Stage.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Stage;