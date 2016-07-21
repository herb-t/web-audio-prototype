'use strict';

var THREE = require('three');

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


var Shaders = function() {

  this.dotEffect = new THREE.ShaderPass(THREE.DotScreenShader);
  this.dotEffect.uniforms['scale'].value = 4;

  this.glitchEffect = new THREE.ShaderPass(THREE.FilmShader);
  this.glitchEffect.uniforms['nIntensity'].value = 0.5;
  this.glitchEffect.uniforms['sIntensity'].value = 0.05;

  this.badTVEffect = new THREE.ShaderPass(THREE.BadTVShader);
  this.badTVEffect.uniforms['speed'].value = 10;
  this.badTVEffect.uniforms['rollSpeed'].value = 20;

  this.rgbEffect = new THREE.ShaderPass(THREE.RGBShiftShader);
  this.rgbEffect.uniforms['amount'].value = 20;
  this.rgbEffect.renderToScreen = true;

};

module.exports = Shaders;