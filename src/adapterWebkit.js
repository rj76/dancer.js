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

    rangeScaleFactor = maxDecibels === minDecibels ? 1 : 1 / (maxDecibels - minDecibels);

    var adapter = function (dancer) {
        this.dancer = dancer;
        this.audio = new Audio();
    };

    adapter.prototype = {
        initContext:function() {
            var self = this;
            try {
                if (!window.my_audio_context) {
                    window.my_audio_context = window.AudioContext ?
                        new window.AudioContext() :
                        new window.webkitAudioContext();
                }
                this.context = window.my_audio_context;

            } catch (err) {
                if (createTimer == null) {
                    createTimer = setInterval(function() {
                        self.initContext();
                    }, 500);
                }

                if (++tries >= max_tries && tries%max_tries==0) {
                    this.dancer.trigger('audioSetupError');
                }
                return;
            }

            this.dancer.trigger('ready');
            tries = 0;
            clearInterval(createTimer);
        },

        load:function (_source) {
            var _this = this;
            this.audio = _source;

            this.isLoaded = false;
            this.progress = 0;

            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = SAMPLE_SIZE / 2;
//            this.analyser.minDecibels = -100;
//            this.analyser.maxDecibels =-30;

            this.gain = this.context.createGainNode();
            this.gain.gain = 0;

            this.fft = new FFT(SAMPLE_SIZE / 2, SAMPLE_RATE);
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
            this.gain.gain.value = volume;
        },

        getVolume:function () {
            return this.gain.gain.value;
        },

        getProgress:function () {
            return this.progress;
        },

        getWaveform:function () {
            return this.signal;
        },

        getSpectrum:function () {
            return this.fft.spectrum;
        },

        getTime:function () {
            return this.audio.currentTime;
        },

        setTime:function (time) {
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
        var data = new Float32Array(SAMPLE_SIZE / 2);
        this.analyser.getFloatFrequencyData(data);

        for (var i=0;i<data.length; i++) {
            // Convert from linear magnitude to unsigned byte decibels.
            var sampleValue = data[i];
            sampleValue = byteMax * (sampleValue - minDecibels) * rangeScaleFactor;
            if (sampleValue < 0) {
                sampleValue = 0;
            }

            if (sampleValue > byteMax) {
                sampleValue = byteMax;
            }

            // Smooth between current sample and last sample.
            data[i] = smoothingFactor *  data[i] + (1 - smoothingFactor) * sampleValue;
        }

        this.fft.spectrum = data;
        this.dancer.trigger('update');
    }

    function connectContext() {
        var self = this;
        this.source = this.context.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        this.isLoaded = true;
        this.progress = 1;
        this.dancer.trigger('loaded');
        this.dancer.trigger('visuals');
    }

    Dancer.adapters.webkit = adapter;

})();
