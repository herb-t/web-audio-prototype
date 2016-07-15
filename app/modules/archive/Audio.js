'use strict';

/*
* WebAudio API frequency & volume data
* loads & plays audio
* create sound 'bars' for equlizer
*/

var Audio = function() {
  console.log('audio');
  var context = new AudioContext();
  var offlineContext = new OfflineAudioContext(1, 512, 3000);

  // this.analyser = context.createAnalyser();
  // this.analyser.smoothingTimeConstant = 0.4;
  // this.analyser.fftSize = 1024;

  // this.analyser2 = context.createAnalyser();
  // this.analyser2.smoothingTimeConstant = 0.4;
  // this.analyser2.fftSize = 1024;

  // this.bassAnalyser = context.createAnalyser();
  // this.bassAnalyser.fftSize = 64;

  // var sourceNode = context.createBufferSource();
  // var offlineSource = offlineContext.createBufferSource();
  // var splitter = context.createChannelSplitter();

  // sourceNode.connect(splitter);

  // splitter.connect(this.analyser, 0);
  // splitter.connect(this.analyser2, 1);

  // sourceNode.connect(context.destination);
  // offlineSource.connect(offlineContext.destination);

  // var request = new XMLHttpRequest();
  // request.open('GET', 'audio/sasha.mp3', true);
  // request.responseType = 'arraybuffer';

  // var songBuffer;
  
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

      }).catch(function(err) {
          console.log('Rendering failed: ' + err);
      });

    }, this._onError);
  };

  request.send();

};

/*
* gives error message if problems retrieving audio
* @param {String} e
*/
Audio.prototype._onError = function(e) {
  console.log(e);
};

module.exports = Audio;