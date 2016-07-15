'use strict';

let uniforms;

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

  this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  this.camera.position.z = 5;

  this.scene = new THREE.Scene();

  this.randomPoints = [];
  
  for ( var i = 0; i < 25; i ++ ) {
      this.randomPoints.push(
          // new THREE.Vector3(Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100)
          new THREE.Vector3( (Math.random() * 200 - 100), (Math.random() * 200 - 100), (Math.random() * 200 - 100) )
      );
  }

  this.spline = new THREE.CatmullRomCurve3(this.randomPoints);

  this.camPosIndex = 0;

  document.body.appendChild(this.renderer.domElement);

};

/*
* get/start audio, add shape mesh and particles
* add custom shader effects and define uniforms
*/
Stage.prototype.init = function() {

  this.getAudio();
  this.createLayout();
  this.createBg();
  this.getLights();

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
  this.badTVEffect.renderToScreen = true;
  this.composer.addPass(this.badTVEffect);

  this.clock = new THREE.Clock();

  requestAnimationFrame(this.animate.bind(this));

  window.addEventListener('resize', this._onResize.bind(this));

  this._onResize();
};

Stage.prototype.createBg = function() {
  var geometry = new THREE.SphereGeometry(150, 32, 32);
  var texture = new THREE.TextureLoader().load('images/bg.jpg');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  this.bgMesh = new THREE.Mesh(geometry, material);

  this.scene.add(this.bgMesh);
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

  // this.particleSystem.rotation.y += 0.01 * delta;
  
  this.renderer.clear();
  this.composer.render(0.1);

  this.updateVisual();
  this.camPosIndex++;
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

  // this.mesh.color.setHex( 0xffffff );

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
  // this.visualMaterial.uniforms['fogDensity'].value = frequencyAverage / 200;
  // this.visualMaterial.uniforms['time'].value = frequencyAverage / 50;

  //this.camera.lookAt(this.spline.getPoint((this.camPosIndex + 10) / frequencyArray * 100));

  // // visual equalizer bars
  // this.barsArray.forEach(function(bar, index) {
  //   bar.style.height = Math.abs(frequencyArray[index]) + 'px';
  //   bar.style.backgroundColor = '#' + (Math.abs(frequencyArray[index]) * 10000);
  // });

  // this.mesh.color = '#' + Math.floor(Math.random() * 16777215).toString(16);
  // console.log( '#' + Math.floor(Math.random() * 16777215).toString(16) );
  // this.mesh.color.setHex( ('0x' + Math.floor(Math.random() * 16777215).toString(16)) );

  // this.particleSystem.scale.y = average / 5000;
  var visualElement1 = this.scene.getObjectByName('particles');
  var visualElement2 = this.scene.getObjectByName('particlez');

  visualElement1.scale.y = frequencyAverage / 70;
  visualElement1.scale.x = frequencyAverage / 70;
  visualElement1.scale.z = frequencyAverage / 60;

  visualElement2.scale.y = frequencyAverage / 70;
  visualElement2.scale.x = frequencyAverage / 70;
  visualElement2.scale.z = frequencyAverage / 60;

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

  // this.soundBars();
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

Stage.prototype.createLayout = function() {

  for (var i = 0; i < 400; i++) {
    this.box = new THREE.Mesh(
      new THREE.BoxGeometry(1,1,1),
      new THREE.MeshBasicMaterial({color: "#EEEDDD"})
    );
    
    this.box.position.x = -300 + Math.random() * 600;
    this.box.position.y = -300 + Math.random() * 600;  
    this.box.position.z = -300 + Math.random() * 600;
    
    this.scene.add(this.box);
  }

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

  // this.visualMesh = new THREE.Mesh( new THREE.TorusGeometry(size, 0.3, 30, 30), this.visualMaterial);
  // this.visualMesh.rotation.x = 0.3;
  // this.scene.add(this.visualMesh);

  var particleBlock = new THREE.PointsMaterial({
    color: 0xa21c1c,
    size: 1.0,
    transparent: true
  });

  particleBlock.blending = THREE.AdditiveBlending;

  var boxGeometry = new THREE.SphereGeometry(4, 12, 12);
  var boxMaterial = new THREE.MeshBasicMaterial({ color: 0xa21c1c, wireframe: true, transparent: true } );
  // this.cube = new THREE.Mesh(boxGeometry, boxMaterial);
  this.cube = new THREE.Points(sphereGeometry, particleBlock);
  this.cube.softParticles = true;
  this.cube.name = 'particles';
  this.scene.add(this.cube);

  var sphereGeometry = new THREE.SphereGeometry(4, 12, 12);
  var sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xa21c1c, wireframe: true, transparent: true } );
  // this.sphere = new THREE.Mesh(sphereGeometry, boxMaterial);
  this.sphere = new THREE.Points(sphereGeometry, particleBlock);
  this.sphere.softParticles = true;
  this.sphere.name = 'particlez';
  // this.sphere.position.y = 50;
  this.sphere.position.x = 50;
  this.scene.add(this.sphere);

  var step = 0;
  this.updatedPath = [];

  for (var i = 0; i < 1000; i++) {
    var r = 1 / 1000;
    step += r;
    this.updatedPath.push(this.spline.getPoint(step));
  };

  var followGeometry =  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.updatedPath), this.updatedPath.length, 2, 16);
  this.mesh = new THREE.Mesh(followGeometry, new THREE.MeshBasicMaterial({color: '#00ffff', wireframe: true, opacity: 0.3}));
  // this.mesh = new THREE.Mesh(followGeometry, this.visualMaterial);
  this.mesh.side = THREE.DoubleSide;
  this.scene.add(this.mesh);
};

Stage.prototype.getLights = function() {
  // this.scene.fog = new THREE.Fog(0xFFFFFF, 1, 1000);

  // this.scene.add(new THREE.AmbientLight(0x222222 ));

  var light = new THREE.PointLight( 0xff0000, 1, 100 );
  // light.position.set(1, 1, 1);
  light.position.copy(this.camera.position);
  this.scene.add(light);

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
  
  // this.composer.setSize( window.innerWidth, window.innerHeight );
  // this.composer.reset();

  // uniforms.resolution.value.x = window.innerWidth;
  // uniforms.resolution.value.y = window.innerHeight;
};

/*
* gives error message if problems retrieving audio
* @param {String} e
*/
Stage.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Stage;