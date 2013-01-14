(function () {

    var adapter = function (dancer) {
        this.dancer = dancer;
        this.audio = new Audio();
    };

    var minDecibels = -100,
        maxDecibels = -30;

    var rangeScaleFactor,
        linear,
        byteMax = 255,
        smoothingFactor = 0.1;

    var spectrum = [];

    rangeScaleFactor = maxDecibels === minDecibels ? 1 : 1 / (maxDecibels - minDecibels);

    adapter.prototype = {
        initContext:function() {
            this.dancer.trigger('ready');
        },

        load:function (_source) {
            var _this = this;
            this.audio = _source;

            this.isLoaded = false;
            this.frameBufferAvailable = false;
            this.clientNotified = false;

            this.progress = 0;
            if (this.audio.readyState < 3) {
                this.audio.addEventListener('loadedmetadata', function () {
                    getMetadata.call(_this);
                }, false);
            } else {
                getMetadata.call(_this);
            }

            this.audio.addEventListener('MozAudioAvailable', function (e) {
                _this.update(e);
            }, false);

            this.audio.addEventListener('progress', function (e) {
//        if ( e.currentTarget.duration ) {
                if (e.currentTarget.duration && ( e.currentTarget.seekable.length > 0 )) {
                    _this.progress = e.currentTarget.seekable.end(0) / e.currentTarget.duration;
                }
            }, false);

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
            this.audio.volume = volume;
        },

        getVolume:function () {
            return this.audio.volume;
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

        getTime:function () {
            return this.audio.currentTime;
        },

        setTime:function (time) {
            this.audio.currentTime = time;
        },

        update:function (e) {
            if (!this.isPlaying || !this.isLoaded || !this.frameBufferAvailable) return;

            // Window the input samples.
            var audioSample = [];

            try {
                for (var i = 0, j = this.bufferSize; i < j; i++) {
                    audioSample[ i ] = ( e.frameBuffer[ 2 * i ] + e.frameBuffer[ 2 * i + 1 ] ) / 2;
                }
            } catch(err) {
                this.frameBufferAvailable = false;
                this.dancer.trigger('noVisuals');
                return;
            }

            if (!this.clientNotified) {
                this.dancer.trigger('visuals');
                this.clientNotified = true;
            }

            applyWindow(audioSample, this.bufferSize);

            this.fft.forward(audioSample);

            this.spectrum = new Float32Array(this.bufferSize);
            for (var j = 0; j < this.bufferSize; j++) {
                // Convert from linear magnitude to unsigned byte decibels.
                linear = this.fft.spectrum[j];
                var sampleValue = !linear ? minDecibels : linearToDecibels(linear);
                sampleValue = byteMax * (sampleValue - minDecibels) * rangeScaleFactor;
                if (sampleValue < 0) {
                    sampleValue = 0;
                }

                if (sampleValue > byteMax) {
                    sampleValue = byteMax;
                }

                // Smooth between current sample and last sample.
                this.spectrum[j] = smoothingFactor *  this.spectrum[j] + (1 - smoothingFactor) * sampleValue;
            }

            this.dancer.trigger('update');
        }
    };

    function getMetadata() {
        this.fbLength = this.audio.mozFrameBufferLength;
        this.channels = this.audio.mozChannels;
        this.rate = this.audio.mozSampleRate;
        this.bufferSize = this.fbLength / this.channels;
        this.fft = new FFT(this.fbLength / this.channels, this.rate);
        this.signal = new Float32Array(this.fbLength / this.channels);
        this.isLoaded = true;
        this.progress = 1;
        this.frameBufferAvailable = true;
        this.dancer.trigger('loaded');
    }

    /**
     * Converts linear value to decibels
     *
     * @method linearToDecibels
     * @param {Number} linear The linear amplitude value
     * @returns Decibel equivalent for linear value
     */
    var linearToDecibels = function (linear) {
        if (!linear) {
            return -1000;
        }

        return 20 * Math.log(linear) / Math.log(10)
    }

    /**
     * Applies window function (Blackman window) to sample
     *
     * @method applyWindow
     * @param {} sample The sample which will be windowed
     * @param {Number} fftSize The size of the fft
     */
    var applyWindow = function (sample, fftSize) {
        var alpha = 0.16,
            a0 = 0.5 * (1 - alpha),
            a1 = 0.5,
            a2 = 0.5 * alpha,
            x,
            window;

        for (i = 0; i < fftSize; i += 1) {
            x = i / fftSize;
            window = a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
            sample[i] *= window;
        }
    }

    Dancer.adapters.moz = adapter;

})();
