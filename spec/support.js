describe('Support', function () {

  var
    song     = 'lib/440hz_100amp.ogg',
    dancer   = new Dancer(song),
    isWebkit = !!window.webkitAudioContext,
    songReady = function () { return dancer.isLoaded() && dancer.getTime() > 1; };

  describe('addPlugin()', function () {
    it('Should add a method to the prototype if not in the chain', function () {
      var fn = jasmine.createSpy();
      Dancer.addPlugin('pluginname', fn);
      dancer.pluginname('arggg');
      expect(fn).toHaveBeenCalledWith('arggg');
    });

    it('Should pass the dancer instance as the "this" context', function () {
      Dancer.addPlugin('pluginname2', function() { return this; });
      expect(dancer.pluginname2()).toBe(dancer);
    });

    it('Should not allow a rebinding of a preexisting prototype method or plugin', function () {
      var
        origMethod = Dancer.prototype.play,
        newMethod = function() { };
      Dancer.addPlugin('play', newMethod);
      Dancer.addPlugin('pluginname', newMethod); // Used in previous test
      expect(dancer.play).toBe(origMethod);
      expect(dancer.pluginname).not.toBe(newMethod);
    });
  });

  describe('isSupported()', function () {
    it('Should test whether or not the browser supports Web Audio or Audio Data', function () {
      var webAudio = window.webkitAudioContext || window.AudioContext,
        audioData  = window.Audio && (new window.Audio()).mozSetup && window.Audio,
        _audio = webAudio || audioData,
        type = webAudio ? 'AudioContext' : 'Audio';

      expect(!!(webAudio || audioData)).toEqual(Dancer.isSupported());
      window.webkitAudioContext = window.AudioContext = window.Audio = false;
      expect(Dancer.isSupported()).toBeFalsy();
      window[ type ] = _audio;
      expect(Dancer.isSupported()).toBeTruthy();
    });
  });

  describe('canPlay()', function () {
    it('Should return the correct support for current browser', function () {
      var audio = document.createElement('audio'),
      canMp3 = audio.canPlayType && audio.canPlayType('audio/mpeg;').replace(/no/,''),
      canOgg = audio.canPlayType && audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/,''),
      canWav = audio.canPlayType && audio.canPlayType('audio/wav; codecs="1"').replace(/no/,''),
      canAac = audio.canPlayType && audio.canPlayType('audio/mp4; codecs="mp4a.40.2"').replace(/no/,'');
      expect(Dancer.canPlay('MP3')).toEqual(!!canMp3);
      expect(Dancer.canPlay('oGg')).toEqual(!!canOgg);
      expect(Dancer.canPlay('WaV')).toEqual(!!canWav);
      expect(Dancer.canPlay('aac')).toEqual(!!canAac);
    });
  });
});