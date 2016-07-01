'use strict';

var config = require('./config');
var Scene = require('./modules/Scene');
// var Stage = require('./modules/Stage');

console.log(config);

var threeScene = new Scene();
threeScene.init();

// var stage = new Stage();
// stage.init();

