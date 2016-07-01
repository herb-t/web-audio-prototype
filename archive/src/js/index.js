'use strict';

var songBuffer;

var Scene = function() {
  this.daScene = document.getElementById('daScene');
  this.renderer = new THREE.WebGLRenderer({alpha: true});

  this.renderer.setSize(window.innerWidth, window.innerHeight);

  this.daScene.appendChild(this.renderer.domElement);

  this.camera = new THREE.PerspectiveCamera(45, (window.innerWidth / window.innerHeight), 0.1, 1000);
  this.camera.position.z = 50;

  this.scene = new THREE.Scene();

  this.tempTimer = 0;

};

Scene.prototype.init = function() {
  this.createBg();
  this.sphereElement();

  // webAudio API - load song
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

  requestAnimationFrame(this.animate.bind(this));

  // on resize
  window.addEventListener('resize', this.onResize.bind(this));

  var request = new XMLHttpRequest();
  request.open('GET', 'src/audio/wham.mp3', true);
  request.crossOrigin = 'anonymous';
  request.responseType = 'arraybuffer';

  // play song
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      songBuffer = buffer;

      var dur = buffer.duration;

      sourceNode.buffer = buffer;
      sourceNode.start(0);
      sourceNode.loop = true;

    }, this._onError);
  }.bind(this);

  request.send();
};


Scene.prototype.animate = function() {
  requestAnimationFrame(this.animate.bind(this));
  var time = Date.now();

  this.update(time);

  this.renderer.render(this.scene, this.camera);
};

Scene.prototype.update = function(time) {
  if (!this.lastTime) {
    this.lastTime = time;
    
    return;
  }

  var diff = time - this.lastTime;
  this.lastTime = time;

  var camera = this.camera;
  var scene = this.scene;
  var speed = this.speed;

  // this.bgMesh.rotation.y = time * 0.00005;
  // this.bgMesh.rotation.z = time * 0.000005;
  //this.camera.rotation.z = time * 0.0005;
  this.partSystem.rotation.y = time * 0.0005;

  this.updateVisual();
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
  this.partSystem.position.x = -2;
  this.partSystem.position.y = 2;
  this.scene.add(this.partSystem);
  document.body.appendChild(this.renderer.domElement);
};

Scene.prototype.getAverageVolume = function(array) {
  var values = 0;
  var average;
  var length = array.length;

  for (var i = 0; i < length; i++) {
    values += array[i];
  }

  average = values / length;

  return average;
};

Scene.prototype.updateVisual = function() {
  var array = new Uint8Array(this.analyser.frequencyBinCount);
  var visualElement = this.scene.getObjectByName('particlez');
  this.analyser.getByteFrequencyData(array);
  var average = this.getAverageVolume(array);
  
  if (songBuffer) {
    this.tempTimer++;
    if ((this.tempTimer / 50) == parseInt((songBuffer.duration / 4), 10)) {
      visualElement.material.color.setHex(0x2dd88e);
      //controls.autoRotate = true;
    }
    if ((this.tempTimer / 50) == parseInt((songBuffer.duration / 3), 10)) {
      visualElement.material.color.setHex(0xc42b2b);
      //controls.autoRotate = true;
    }
  }

  if (visualElement) {
    visualElement.scale.y = average / 70;
    visualElement.scale.x = average / 70;
    visualElement.scale.z = average / 60;
    this.bgMesh.rotation.z = average / 2000;
  }
};

Scene.prototype.render = function() {
  //this.controls.update();
  this.updateVisual();
  this.renderer.render(this.scene, this.camera);
  requestAnimationFrame(this.render);
};

Scene.prototype.createBg = function() {
  var geometry = new THREE.SphereGeometry(150, 32, 32);
  var texture = new THREE.TextureLoader().load('src/images/bg.jpg');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  this.bgMesh = new THREE.Mesh(geometry, material);

  this.scene.add(this.bgMesh);
};

Scene.prototype.onResize = function() {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize( window.innerWidth, window.innerHeight );
};

Scene.prototype._onError = function(e) {
  console.log(e);
};

var threeScene = new Scene();
threeScene.init();
