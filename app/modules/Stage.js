'use strict';

var uniforms;

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
var ConvolutionShader = require('../shaders/ConvolutionShader.js');

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

  document.body.appendChild(this.renderer.domElement);

  this.camera = new THREE.PerspectiveCamera(70, (window.innerWidth / window.innerHeight), 1, 1000);
  //this.camera.position.z = 50;
  this.camera.position.z = 400;

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  //this.controls.autoRotate = true;

  this.getLights();
  this.getObjects();
  
  this.tempTimer = 0;

};

Stage.prototype.init = function() {
  //this.createBg();
  // this.sphereElement();
  // this.getShaders();
  // this.getAudio();

  requestAnimationFrame(this.animate.bind(this));

  // on resize
  window.addEventListener('resize', this._onResize.bind(this));

  // TweenMax.to(document.querySelector('.bg'), 2000, {
  //   rotation: 1080,
  //   yoyo: true,
  //   repeat: -1,
  //   ease: Power1.easeOut
  // });

  this.clock = new THREE.Clock();
  var container = document.getElementById('container');

  var textureLoader = new THREE.TextureLoader();

  var uniforms = {

    fogDensity: { value: 0.45 },
    fogColor:   { value: new THREE.Vector3( 0, 0, 0 ) },
    time:       { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
    uvScale:    { value: new THREE.Vector2( 3.0, 1.0 ) },
    texture1:   { value: textureLoader.load( "images/cloud.png" ) },
    texture2:   { value: textureLoader.load( "images/lavatile.jpg" ) }

  };

  uniforms.texture1.value.wrapS = uniforms.texture1.value.wrapT = THREE.RepeatWrapping;
  uniforms.texture2.value.wrapS = uniforms.texture2.value.wrapT = THREE.RepeatWrapping;

  var size = 0.65;

  var material = new THREE.ShaderMaterial( {

    uniforms: uniforms,
    vertexShader: document.getElementById( 'vertexShader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentShader' ).textContent

  } );

  this.mesh = new THREE.Mesh( new THREE.TorusGeometry( size, 0.3, 30, 30 ), material );
  this.mesh.rotation.x = 0.3;
  this.scene.add( this.mesh );

  //

  this.renderer = new THREE.WebGLRenderer( { antialias: true } );
  this.renderer.setPixelRatio( window.devicePixelRatio );
  document.body.appendChild( this.renderer.domElement );
  this.renderer.autoClear = false;

  //

  //stats = new Stats();
  //container.appendChild( stats.dom );

  //

  this.renderModel = new THREE.RenderPass( this.scene, this.camera );
  this.effectBloom = new THREE.BloomPass( 1.25 );
  this.effectFilm = new THREE.FilmPass( 0.35, 0.95, 2048, false );

  this.effectFilm.renderToScreen = true;

  this.composer = new THREE.EffectComposer( this.renderer );

  this.composer.addPass(this.renderModel);
  this.composer.addPass(this.effectBloom);
  this.composer.addPass(this.effectFilm);
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

  this.object.rotation.x += 0.0025;
  this.object.rotation.y += 0.001;
  //this.partSystem.rotation.y = time * 0.0005;

  var delta = 5 * this.clock.getDelta();

  uniforms.time.value += 0.2 * delta;

  this.mesh.rotation.y += 0.0125 * delta;
  this.mesh.rotation.x += 0.05 * delta;

  this.renderer.clear();
  this.composer.render( 0.01 );

  this.controls.update()
  //this.composer.render();
  this.updateVisual();

};

Stage.prototype.updateVisual = function() {
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

Stage.prototype.getObjects = function() {
  this.object = new THREE.Object3D();
  this.scene.add(this.object);

  this.object.name = 'myScene';

  var geometry = new THREE.SphereGeometry( 1, 32, 32 );
  var material = new THREE.MeshPhongMaterial( { color: 0xffffff, shading: THREE.FlatShading } );

  for ( var i = 0; i < 100; i ++ ) {

    var mesh = new THREE.Mesh( geometry, material );
    mesh.position.set( Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5 ).normalize();
    mesh.position.multiplyScalar( Math.random() * 400 );
    mesh.rotation.set( Math.random() * 2, Math.random() * 2, Math.random() * 2 );
    mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 50;
    this.object.add( mesh );

  }

};

Stage.prototype.sphereElement = function() {
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

Stage.prototype.getLights = function() {
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.Fog(0x000000, 1, 1000);

  this.scene.add(new THREE.AmbientLight(0x222222 ));

  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(1, 1, 1);
  this.scene.add(light);
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

// postprocessing
Stage.prototype.getShaders = function() {
  
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
};

Stage.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Stage;