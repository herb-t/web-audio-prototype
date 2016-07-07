'use strict';

var THREE = require('three');
var TweemMax = require('../vendor/TweenMax.min.js');

var OrbitControls = require('../libs/OrbitControls.js');

var CopyShader = require('../shaders/CopyShader.js');
var DotScreenShader = require('../shaders/DotScreenShader.js');
var RGBShiftShader = require('../shaders/RGBShiftShader.js');
var DigitalGlitch = require('../shaders/DigitalGlitch.js');
var FilmShader = require('../shaders/FilmShader.js');
var BadTv = require('../shaders/BadTv.js');
var FilmShader = require('../shaders/FilmShader.js');

var EffectComposer = require('../libs/EffectComposer.js');
var RenderPass = require('../libs/RenderPass.js');
var MaskPass = require('../libs/MaskPass.js');
var ShaderPass = require('../libs/ShaderPass.js');

var Scene = function() {
  
  this.renderer = new THREE.WebGLRenderer({alpha: true});
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  document.body.appendChild(this.renderer.domElement);

  this.camera = new THREE.PerspectiveCamera(70, (window.innerWidth / window.innerHeight), 1, 1000);
  //this.camera.position.z = 50;
  this.camera.position.z = 400;

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.autoRotate = true;

  this.getLights();
  this.getObjects();
  
  this.tempTimer = 0;

};

Scene.prototype.init = function() {
  //this.createBg();
  this.sphereElement();
  this.getShaders();
  this.getAudio();

  requestAnimationFrame(this.animate.bind(this));

  // on resize
  window.addEventListener('resize', this._onResize.bind(this));

  TweenMax.to(document.querySelector('.bg'), 2000, {
    rotation: 1080,
    yoyo: true,
    repeat: -1,
    ease: Power1.easeOut
  });
};

Scene.prototype.animate = function() {
  requestAnimationFrame(this.animate.bind(this));
  var time = Date.now();

  this.update(time);

  this.renderer.render(this.scene, this.camera);
};

Scene.prototype.update = function(time) {
  var diff = time - this.lastTime;
  this.lastTime = time;

  if (!this.lastTime) {
    this.lastTime = time;
    
    return;
  }  

  this.object.rotation.x += 0.0025;
  this.object.rotation.y += 0.001;
  this.partSystem.rotation.y = time * 0.0005;

  this.controls.update()
  this.composer.render();
  this.updateVisual();

};

Scene.prototype.updateVisual = function() {
  var array = new Uint8Array(this.analyser.frequencyBinCount);
  var visualElement = this.scene.getObjectByName('particlez');
  var visualElement2 = this.scene.getObjectByName('myScene');
  this.analyser.getByteFrequencyData(array);
  var average = this._getAverageVolume(array);

  if (visualElement || visualElement2) {
    visualElement.scale.y = average / 70;
    visualElement.scale.x = average / 70;
    visualElement.scale.z = average / 60;

    this.rgbEffect.uniforms['amount'].value = average / 300;
    this.rgbEffect.uniforms['angle'].value = average / 100;
    this.dotEffect.uniforms['scale'].value = average / 20;
    this.glitchEffect.uniforms['nIntensity'].value = average / 2000;
    
    this.bgMesh.rotation.z = average / 2000;
    this.object.rotation.x = average / 2000;
    this.object.rotation.y = average / 2000;
  }

};

Scene.prototype.getAudio = function() {
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
  request.open('GET', 'audio/wham.mp3', true);
  request.crossOrigin = 'anonymous';
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

Scene.prototype.getObjects = function() {
  this.object = new THREE.Object3D();
  this.scene.add(this.object);

  this.object.name = 'myScene';

  var geometry = new THREE.SphereGeometry( 1, 32, 32 );
  var texture = new THREE.TextureLoader().load('images/eye.jpg');
  var material = new THREE.MeshPhongMaterial({ 
    //color: 0xffffff, 
    map: texture
  });

  for ( var i = 0; i < 100; i ++ ) {

    var mesh = new THREE.Mesh( geometry, material );
    mesh.position.set( Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5 ).normalize();
    mesh.position.multiplyScalar( Math.random() * 400 );
    mesh.rotation.set( Math.random() * 2, Math.random() * 2, Math.random() * 2 );
    mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 50;
    this.object.add( mesh );

  }

};

Scene.prototype.sphereElement = function() {
  var sphereGeometry = new THREE.SphereGeometry(4, 12, 12);

  var particleBlock = new THREE.PointsMaterial({
    color: 0x665fc6,
    size: 1.0,
    transparent: true
  });

  particleBlock.blending = THREE.AdditiveBlending;
  
  this.partSystem = new THREE.Points(sphereGeometry, particleBlock);
  this.partSystem.softParticles = true;
  this.partSystem.name = 'particlez';
  // this.partSystem.position.x = -2;
  // this.partSystem.position.y = 2;
  this.partSystem.position.set(0, 0, 100);
  this.scene.add(this.partSystem);
  document.body.appendChild(this.renderer.domElement);
};

Scene.prototype.getLights = function() {
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.Fog(0x000000, 1, 1000);

  this.scene.add(new THREE.AmbientLight(0x222222 ));

  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(1, 1, 1);
  this.scene.add(light);
};

Scene.prototype.createBg = function() {
  var geometry = new THREE.SphereGeometry(150, 32, 32);
  var texture = new THREE.TextureLoader().load('images/bg.jpg');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  this.bgMesh = new THREE.Mesh(geometry, material);

  this.scene.add(this.bgMesh);
};

// postprocessing
Scene.prototype.getShaders = function() {
  
  this.composer = new THREE.EffectComposer(this.renderer);
  this.composer.addPass( new THREE.RenderPass(this.scene, this.camera));

  this.dotEffect = new THREE.ShaderPass(THREE.DotScreenShader);
  this.dotEffect.uniforms['scale'].value = 4;
  //this.dotEffect.uniforms['scale'].value = 200;
  //this.dotEffect.renderToScreen = true;
  this.composer.addPass(this.dotEffect);

  this.glitchEffect = new THREE.ShaderPass(THREE.FilmShader);
  this.glitchEffect.uniforms['nIntensity'].value = 0.5;
  this.glitchEffect.uniforms['sIntensity'].value = 0.05;
  //this.glitchEffect.renderToScreen = true;
  this.composer.addPass(this.glitchEffect);

  this.badTVEffect = new THREE.ShaderPass(THREE.BadTVShader);
  this.badTVEffect.uniforms['speed'].value = 10;
  this.badTVEffect.uniforms['rollSpeed'].value = 20;
  //this.badTVEffect.renderToScreen = true;
  this.composer.addPass(this.badTVEffect);

  this.rgbEffect = new THREE.ShaderPass(THREE.RGBShiftShader);
  this.rgbEffect.uniforms['amount'].value = 20;
  this.rgbEffect.renderToScreen = true;
  this.composer.addPass(this.rgbEffect);

};

Scene.prototype._getAverageVolume = function(array) {
  var values = 0;
  var average;
  var length = array.length;

  for (var i = 0; i < length; i++) {
    values += array[i];
  }

  average = values / length;

  return average;
};

Scene.prototype._onResize = function() {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize( window.innerWidth, window.innerHeight );
  this.composer.setSize( window.innerWidth, window.innerHeight );
};

Scene.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Scene;