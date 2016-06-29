'use strict';

var camera;
var scene;
var renderer;
var analyser;
var analyser2;
var controls;
var sourceNode;
var tempTimer = 0;
var songBuffer;
var plane;
var context;

var init = function() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, (window.innerWidth / window.innerHeight), 0.1, 1000);
  camera.position.x = 25;
  camera.position.y = 5;
  camera.position.z = 30;
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({alpha: true});
  renderer.setSize(window.innerWidth, window.innerHeight);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.autoRotate = true;

  createAudio();
  createBg();
  render();
  sphereElement();
  loadSong('src/audio/wham.mp3');

  window.addEventListener('resize', onResize);
};

var sphereElement = function() {
  var sphereGeometry = new THREE.SphereGeometry(4, 12, 12);

  var particleBlock = new THREE.PointsMaterial({
    color: 0x665fc6,
    size: 1.0,
    transparent: true
  });

  particleBlock.blending = THREE.AdditiveBlending;
  
  var partSystem = new THREE.Points(sphereGeometry, particleBlock);
  partSystem.softParticles = true;
  partSystem.name = 'particlez';
  partSystem.position.x = -2;
  partSystem.position.y = 2;
  scene.add(partSystem);
  document.body.appendChild(renderer.domElement);
};

var createAudio = function() {
  context = new AudioContext();
  analyser = context.createAnalyser();
  analyser.smoothingTimeConstant = 0.4;
  analyser.fftSize = 1024;

  analyser2 = context.createAnalyser();
  analyser2.smoothingTimeConstant = 0.4;
  analyser2.fftSize = 1024;

  sourceNode = context.createBufferSource();
  var splitter = context.createChannelSplitter();

  sourceNode.connect(splitter);

  splitter.connect(analyser, 0);
  splitter.connect(analyser2, 1);

  sourceNode.connect(context.destination);

};

var loadSong = function(name) {
  var request = new XMLHttpRequest();
  request.open('GET', name, true);
  request.crossOrigin = 'anonymous';
  request.responseType = 'arraybuffer';

  // TODO: use Promise
  // context.decodeAudioData(request.response).then(function(buffer){
  //   songBuffer = buffer;
  //   buffer.loop = true;
  //   playSong(buffer);
  // });
  
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      songBuffer = buffer;
      playSong(buffer);
    }, _onError);
  };

  request.send();
};

var playSong = function(buffer) {
  var dur = buffer.duration;
  sourceNode.buffer = buffer;
  sourceNode.start(0);
  sourceNode.loop = true;
};

var getAverageVolume = function(array) {
  var values = 0;
  var average;
  var length = array.length;

  for (var i = 0; i < length; i++) {
    values += array[i];
  }

  average = values / length;

  return average;
};

var updateVisual = function() {
  var array = new Uint8Array(analyser.frequencyBinCount);
  var visualElement = scene.getObjectByName('particlez');
  analyser.getByteFrequencyData(array);
  var average = getAverageVolume(array);
  
  if (songBuffer) {
    tempTimer++;
    if ((tempTimer / 50) == parseInt((songBuffer.duration / 4), 10)) {
      visualElement.material.color.setHex(0x2dd88e);
      controls.autoRotate = true;
    }
    if ((tempTimer / 50) == parseInt((songBuffer.duration / 3), 10)) {
      visualElement.material.color.setHex(0xc42b2b);
      controls.autoRotate = true;
    }
  }

  if (visualElement) {
    visualElement.scale.y = average / 70;
    visualElement.scale.x = average / 70;
    visualElement.scale.z = average / 60;
  }
};

var render = function() {
  controls.update();
  updateVisual();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
};

var createBg = function() {
  var geometry = new THREE.SphereGeometry(150, 32, 32);
  var texture = new THREE.TextureLoader().load('src/images/bg.jpg');
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  var bgMesh = new THREE.Mesh(geometry, material);

  scene.add(bgMesh);
};

var onResize = function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
};

var _onError = function(e) {
  console.log(e);
};

window.onload = init;