export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioElement = new Audio();
        this.audioElement.crossOrigin = "anonymous";
        this.source = this.ctx.createMediaElementSource(this.audioElement);
        
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        // Create MediaStreamDestination for recording
        this.streamDestination = this.ctx.createMediaStreamDestination();

        // Connect audio graph: source -> analyser -> both destination and streamDestination
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this.analyser.connect(this.streamDestination);

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.waveformData = new Uint8Array(this.analyser.fftSize);

        // Beat detection
        this.beatThreshold = 1.3; // Threshold multiplier
        this.beatHistory = [];
        this.beatHistorySize = 10;
        this.isBeat = false;

        // Track ended callback
        this.onTrackEnded = null;
        this.audioElement.addEventListener('ended', () => {
            console.log('Audio element ended event fired');
            if (this.onTrackEnded) {
                console.log('Calling onTrackEnded callback');
                this.onTrackEnded();
            } else {
                console.log('No onTrackEnded callback set');
            }
        });
    }

    loadTrack(url) {
        this.audioElement.src = url;
        this.audioElement.load();
    }

    play() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.audioElement.play();
    }

    pause() {
        this.audioElement.pause();
    }

    update() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.waveformData);

        // Calculate average energy for beat detection (focus on bass)
        let bassSum = 0;
        let bassCount = 0;
        // Low frequencies are at the beginning of the array. 
        // 44100Hz / 2048 = ~21.5Hz per bin.
        // Bass: 20-140Hz -> bins 1 to 7 roughly.
        for (let i = 0; i < 10; i++) {
            bassSum += this.frequencyData[i];
            bassCount++;
        }
        const currentBassEnergy = bassSum / bassCount;

        // Beat detection logic
        const averageHistory = this.beatHistory.reduce((a, b) => a + b, 0) / (this.beatHistory.length || 1);
        
        if (currentBassEnergy > averageHistory * this.beatThreshold && currentBassEnergy > 100) {
            this.isBeat = true;
        } else {
            this.isBeat = false;
        }

        this.beatHistory.push(currentBassEnergy);
        if (this.beatHistory.length > this.beatHistorySize) {
            this.beatHistory.shift();
        }
    }

    getFrequencyData() {
        return this.frequencyData;
    }

    getWaveformData() {
        return this.waveformData;
    }

    getAverageFrequency() {
        const sum = this.frequencyData.reduce((a, b) => a + b, 0);
        return sum / this.frequencyData.length;
    }

    // Helper to get specific band energy (0-255)
    // band: 'bass', 'mid', 'treble'
    getBandEnergy(band) {
        const binCount = this.analyser.frequencyBinCount;
        let start, end;

        if (band === 'bass') {
            start = 0;
            end = Math.floor(binCount * 0.05); // 0-5% (approx 0-1000hz depending on sample rate)
        } else if (band === 'mid') {
            start = Math.floor(binCount * 0.05);
            end = Math.floor(binCount * 0.25);
        } else if (band === 'treble') {
            start = Math.floor(binCount * 0.25);
            end = binCount;
        }

        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += this.frequencyData[i];
        }
        return sum / (end - start);
    }

    getAudioStream() {
        return this.streamDestination.stream;
    }

    getCurrentTime() {
        return this.audioElement.currentTime;
    }

    setCurrentTime(time) {
        this.audioElement.currentTime = time;
    }
}
