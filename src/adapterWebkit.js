(function () {
    var
        SAMPLE_SIZE = 2048,
        SAMPLE_RATE = 44100;

    var minDecibels = -100,
        maxDecibels = -30;

    var rangeScaleFactor,
        linear,
        byteMax = 255,
        smoothingFactor = 0.1;

    var createTimer = null;
    var tries = 0, max_tries = 10;

    var cnt = 0, min_float=0,max_float=0,min_byte=0,max_byte=0;

    rangeScaleFactor = maxDecibels === minDecibels ? 1 : 1 / (maxDecibels - minDecibels);

    var adapter = function (dancer) {
        this.dancer = dancer;
        this.audio = new Audio();
        this.old_volume = 0;
        this.mute = false;
    };

    adapter.prototype = {
        initContext:function() {
            var self = this;
            try {
                if (!window.globalContext) {
                    window.globalContext = window.AudioContext ?
                        new window.AudioContext() :
                        new window.webkitAudioContext();
                }
                this.context = window.globalContext;

            } catch (err) {
                if (++tries >= max_tries && tries%max_tries==0) {
                    console.log('error: '+err);
                    this.dancer.trigger('audioSetupError');
                    clearInterval(createTimer);
                }

                if (createTimer == null) {
                    createTimer = setInterval(function() {
                        self.initContext();
                    }, 500);
                }

                return;
            }

            this.dancer.trigger('ready');
            tries = 0;
            clearInterval(createTimer);
        },

        getContext:function() {
            return this.context;
        },

        load:function (_source) {
            var _this = this;
            this.audio = _source;

            this.isLoaded = false;
            this.progress = 0;

            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = SAMPLE_SIZE;
//            this.analyser.minDecibels = -100;
//            this.analyser.maxDecibels =-30;


            this.gain = this.context.createGain();
            this.gain.gain = 0;

//            this.fft = new FFT(SAMPLE_SIZE / 2, SAMPLE_RATE);
            this.signal = new Float32Array(SAMPLE_SIZE / 2);

            if (this.audio.readyState < 3) {
                this.audio.addEventListener('canplay', function () {
                    connectContext.call(_this);
                    updateFreq.call(_this);
                });
            } else {
                connectContext.call(_this);
                updateFreq.call(_this);
            }

            this.audio.addEventListener('progress', function (e) {
                if (e.currentTarget.duration && ( e.currentTarget.seekable.length > 0 )) {
                    _this.progress = e.currentTarget.seekable.end(0) / e.currentTarget.duration;
                }
            });

            return this.audio;
        },

        play:function () {
            this.audio.play();
            this.isPlaying = true;
        },

        pause:function () {
            this.audio.pause();
            this.isPlaying = false;
        },

        setVolume:function (volume) {
            if (this.mute) {
                this.old_volume = volume;
            } else {
                this.gain.gain.value = volume;
            }
        },

        getVolume:function () {
            return this.gain.gain.value;
        },

        setMute:function (mute) {
            this.mute = mute;
            if (mute) {
                this.old_volume = this.gain.gain.value;
                this.gain.gain.value = 0;
            } else {
                this.gain.gain.value = this.old_volume;
            }
        },

        getProgress:function () {
            return this.progress;
        },

        getWaveform:function () {
            return this.signal;
        },

        getSpectrum:function () {
            return this.spectrum;
        },

        getByteSpectrum:function () {
            return this.byte_spectrum;
        },

        getLinearSpectrum:function () {
            return this.fft.spectrum;
        },

        getTime:function () {
            return this.audio.currentTime;
        },

        setTime:function (time) {
            if (!this.isLoaded) return;
            this.audio.currentTime = time;
        },

        update:function (e) {
            if (!this.isPlaying || !this.isLoaded) return;

            var
                buffers = [],
                channels = e.inputBuffer.numberOfChannels,
                resolution = SAMPLE_SIZE / channels,
                sum = function (prev, curr) {
                    return prev[ i ] + curr[ i ];
                }, i;

            for (i = channels; i--;) {
                buffers.push(e.inputBuffer.getChannelData(i));
            }

            for (i = 0; i < resolution; i++) {
                this.signal[ i ] = channels > 1 ?
                    buffers.reduce(sum) / channels :
                    buffers[ 0 ][ i ];
            }

            this.fft.forward(this.signal);
            this.dancer.trigger('update');
        }
    };

    function updateFreq() {
        var self = this;
        if (!this.timeset) {
            window.setInterval(function () {
                updateFreq.call(self);
            }, 50);
            self.timeset = true;
        }
        cnt++;

        var data = new Float32Array(SAMPLE_SIZE);
        var byte_data = new Uint8Array(SAMPLE_SIZE);
        this.analyser.getFloatFrequencyData(data);
        this.analyser.getByteFrequencyData(byte_data);

        this.spectrum = data;
        this.byte_spectrum = byte_data;
        this.dancer.trigger('update');
    }

    function decibelsToLinear(db) {
        return Math.pow(10.0, 0.05 * db);
    }

    function connectContext() {
        var self = this, last;
        this.source = this.context.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        last = this.analyser;

        if (this.dancer.frequencybox) {
            last.connect(this.dancer.frequencybox.getAudioNode());
            last = this.dancer.frequencybox.getAudioNode();
        }

        if (this.dancer.wavebox) {
            last.connect(this.dancer.wavebox.getAudioNode());
            last = this.dancer.wavebox.getAudioNode();
        }

        if (this.gain) {
            last.connect(this.gain);
            last = this.gain;
        }

        last.connect(this.context.destination);
        this.isLoaded = true;
        this.progress = 1;
        this.dancer.trigger('loaded');
        this.dancer.trigger('visuals');
    }

    Dancer.adapters.webkit = adapter;

})();
