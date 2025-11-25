import { tracks } from '../tracks.js';
import { RecorderManager } from '../utils/RecorderManager.js';

export class UIManager {
    constructor(audioManager, visualizer) {
        this.audioManager = audioManager;
        this.visualizer = visualizer;
        this.recorderManager = new RecorderManager();
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isRecording = false;

        // DOM Elements
        this.uiLayer = document.getElementById('ui-layer');
        this.trackListContainer = document.getElementById('track-list');
        this.trackContainer = document.getElementById('track-container');
        this.playBtn = document.getElementById('play-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.recordBtn = document.getElementById('record-btn');
        this.titleEl = document.getElementById('current-track-title');
        this.artistEl = document.getElementById('current-track-artist');
        
        this.signalVal = document.getElementById('signal-val');
        this.peakVal = document.getElementById('peak-val');
        this.signalCanvas = document.getElementById('signal-canvas');
        this.peakCanvas = document.getElementById('peak-canvas');
        this.signalCtx = this.signalCanvas.getContext('2d');
        this.peakCtx = this.peakCanvas.getContext('2d');

        this.startOverlay = document.getElementById('start-overlay');
        
        // New Notification System
        this.notifOverlay = document.getElementById('notification-overlay');
        this.notifTitle = document.getElementById('notif-title');
        this.notifText = document.getElementById('notif-text');
        this.notifIcon = document.getElementById('notif-icon');
        
        this.floatingContainer = document.getElementById('floating-cards-container');
        this.statusBadge = document.getElementById('mode-display');

        // Logic State
        this.lastBeatTime = 0;
        this.timeSinceLastPopup = 0;
        this.popupInterval = 30; // Less frequent
        
        // UI Auto-Hide State
        this.isCinematic = false;
        this.inactivityTimer = 0;
        this.hiddenTimer = 0; // Track how long UI has been hidden
        this.INACTIVITY_THRESHOLD = 4.0;
        this.REAPPEAR_INTERVAL = 15.0;
        
        this.signalHistory = new Array(50).fill(0); // For rolling graph

        this.popups = [
            { title: "AUDIO ENGINE", text: "Phase alignment optimized.", icon: "II" },
            { title: "VISUAL CORE", text: "Rendering pipeline active.", icon: "O" },
            { title: "SYSTEM CHECK", text: "All parameters nominal.", icon: "OK" },
            { title: "BUFFER STATUS", text: "Latency minimal.", icon: ">>" },
            { title: "FREQUENCY", text: "Spectrum analysis running.", icon: "HZ" }
        ];

        this.init();
    }

    init() {
        this.renderTrackList();
        this.setupEventListeners();
        this.updateTrackInfo();
        
        // Handle Canvas resizing (basic)
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
    }
    
    resizeCanvases() {
        if (!this.signalCanvas.parentElement) return;
        const width = this.signalCanvas.parentElement.clientWidth - 48; // minus padding
        this.signalCanvas.width = width;
        this.peakCanvas.width = width;
        this.signalCanvas.height = 60;
        this.peakCanvas.height = 60;
    }

    renderTrackList() {
        this.trackListContainer.innerHTML = '';
        
        tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = `track-item ${index === this.currentTrackIndex ? 'active' : ''}`;
            item.onclick = () => this.playTrack(index);
            
            item.innerHTML = `
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-genre">${track.genre}</div>
                </div>
                ${index === this.currentTrackIndex ? '<span>>></span>' : ''}
            `;
            this.trackListContainer.appendChild(item);
        });
    }

    setupEventListeners() {
        this.playBtn.onclick = () => this.togglePlay();
        this.prevBtn.onclick = () => this.playTrack((this.currentTrackIndex - 1 + tracks.length) % tracks.length);
        this.nextBtn.onclick = () => this.playTrack((this.currentTrackIndex + 1) % tracks.length);
        this.recordBtn.onclick = () => this.toggleRecord();

        this.startOverlay.onclick = () => {
            this.startOverlay.classList.add('hidden');
            // Init audio context on user gesture
            this.audioManager.ctx.resume().then(() => {
                this.playTrack(0);
            });
        };

        // Setup track ended listener
        this.audioManager.onTrackEnded = () => {
            console.log('Track ended event fired, isRecording:', this.isRecording);
            if (this.isRecording) {
                this.stopRecording();
            }
        };

        // Auto-hide / Reappear Logic
        document.addEventListener('mousemove', () => {
            this.inactivityTimer = 0;
        });

        document.addEventListener('click', () => {
            this.inactivityTimer = 0;
            if (this.isCinematic) {
                this.isCinematic = false;
                this.updateCinematicState();
            }
        });
    }

    playTrack(index) {
        this.currentTrackIndex = index;
        const track = tracks[index];
        
        this.audioManager.loadTrack(track.url);
        this.audioManager.play();
        this.isPlaying = true;
        this.updatePlayButton();
        this.updateTrackInfo();
        this.renderTrackList(); 

        this.switchVisuals(track.genre);
        this.updateUITheme(track.genre);
        
        // Reset UI timer to ensure controls are visible when track changes
        this.resetToFullUI();
        
        this.triggerNotification({
            title: "NOW PLAYING",
            text: `${track.title}`,
            icon: ">>"
        });
    }

    switchVisuals(genre) {
        const lower = genre.toLowerCase();
        
        if (lower.includes('cyberpunk')) {
            this.visualizer.setPreset('Neon');
        } else if (lower.includes('ethereal')) {
            this.visualizer.setPreset('Ethereal');
        } else if (lower.includes('dark')) {
            this.visualizer.setPreset('Dark');
        } else if (lower.includes('energetic')) {
            this.visualizer.setPreset('Energy');
        } else if (lower.includes('electronic') || lower.includes('rave') || lower.includes('phonk')) {
            this.visualizer.setPreset('Grid');
        } else if (lower.includes('cinematic') || lower.includes('poly')) {
            this.visualizer.setPreset('Pentagon'); 
        } else if (lower.includes('future funk') || lower.includes('2000s')) {
            this.visualizer.setPreset('Wave');
        } else {
            this.visualizer.setPreset('Cosmic');
        }
    }

    updateUITheme(genre) {
        const lower = genre.toLowerCase();
        let color = '#00F0FF'; // Default Cyan

        if (lower.includes('cyberpunk')) color = '#FF00FF'; // Magenta
        if (lower.includes('ethereal')) color = '#AAEEFF'; // Pastel Blue
        if (lower.includes('dark')) color = '#FF3333'; // Red
        if (lower.includes('energetic')) color = '#33FF33'; // Green
        
        // Apply to some elements
        document.documentElement.style.setProperty('--accent-color', color); // Assuming CSS var exists or I will use inline
        
        // Direct manipulation
        this.playBtn.style.borderColor = color;
        this.recordBtn.style.borderColor = color;
        this.statusBadge.style.color = color;
        this.notifIcon.style.color = color;
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audioManager.pause();
        } else {
            this.audioManager.play();
        }
        this.isPlaying = !this.isPlaying;
        this.updatePlayButton();
        this.resetToFullUI();
    }

    updatePlayButton() {
        this.playBtn.textContent = this.isPlaying ? '||' : '>';
    }

    updateTrackInfo() {
        const track = tracks[this.currentTrackIndex];
        this.titleEl.textContent = track.title;
        this.artistEl.textContent = track.genre.toUpperCase(); 
    }

    toggleRecord() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    async startRecording() {
        // Get the current track info
        const track = tracks[this.currentTrackIndex];
        
        // Reset track to beginning
        this.audioManager.setCurrentTime(0);
        
        // Get streams
        const audioStream = this.audioManager.getAudioStream();
        const canvasElement = this.visualizer.getCanvasElement();
        
        // Start recording
        const sanitizedTitle = track.title.replace(/[^a-z0-9]/gi, '_');
        await this.recorderManager.startRecording(canvasElement, audioStream, sanitizedTitle);
        
        // Start playback
        this.audioManager.play();
        this.isPlaying = true;
        this.isRecording = true;
        
        // Update UI
        this.updatePlayButton();
        this.recordBtn.classList.add('recording');
        
        // Show notification
        this.triggerNotification({
            title: "RECORDING STARTED",
            text: `Capturing: ${track.title}`,
            icon: "●"
        });
        
        // Reset UI timer
        this.resetToFullUI();
    }

    stopRecording() {
        console.log('UIManager.stopRecording called, isRecording:', this.isRecording);
        
        if (!this.isRecording) {
            console.log('Not recording, returning');
            return;
        }
        
        console.log('Calling recorderManager.stopRecording()');
        this.recorderManager.stopRecording();
        this.isRecording = false;
        
        // Update UI
        this.recordBtn.classList.remove('recording');
        
        // Show notification
        this.triggerNotification({
            title: "RECORDING COMPLETE",
            text: "Video download initiated",
            icon: "✓"
        });
        
        console.log('stopRecording complete');
    }

    triggerNotification(data) {
        this.notifTitle.textContent = data.title;
        this.notifText.textContent = data.text;
        this.notifIcon.textContent = data.icon;
        
        this.notifOverlay.classList.add('visible');
        
        if(this.notifTimeout) clearTimeout(this.notifTimeout);
        
        this.notifTimeout = setTimeout(() => {
            this.notifOverlay.classList.remove('visible');
        }, 4000);
    }

    spawnFloatingCard(type = 'random') {
        const card = document.createElement('div');
        card.className = 'floating-card';
        
        let contentText = "";
        let positionClass = "";
        
        if (type === 'bass') {
            const bassMsgs = ["BASS: CRITICAL", "LOW FREQ: DETECTED", "SUB: ACTIVE", "IMPACT: HIGH"];
            contentText = bassMsgs[Math.floor(Math.random() * bassMsgs.length)];
            card.style.borderLeftColor = '#ff3333'; // Red accent for bass
        } else if (type === 'treble') {
            const trebleMsgs = ["HI-FREQ: PEAKING", "AIR: DETECTED", "SHIMMER: ON", "CLARITY: MAX"];
            contentText = trebleMsgs[Math.floor(Math.random() * trebleMsgs.length)];
            card.style.borderLeftColor = '#33ffff'; // Cyan for treble
        } else {
            const msgs = [
                "STEREO: WIDE", "PHASE: ALIGNED", "SYNC: 100%", "VOYAGE: ONGOING", 
                "DATA: FLOWING", "SIGNAL: STRONG", "RESONANCE: FOUND"
            ];
            contentText = msgs[Math.floor(Math.random() * msgs.length)];
        }
        
        card.textContent = contentText;
        
        // Strategic Positioning
        // Stereo-wide feel: prefer edges (10-20% or 80-90% X)
        const side = Math.random() > 0.5 ? 'left' : 'right';
        let x;
        if (side === 'left') x = 5 + Math.random() * 20; // 5-25%
        else x = 75 + Math.random() * 20; // 75-95%
        
        const y = 20 + Math.random() * 60; // 20-80% vertical
        
        card.style.left = x + '%';
        card.style.top = y + '%';
        
        this.floatingContainer.appendChild(card);
        
        // Trigger reflow
        card.offsetHeight;
        
        card.style.opacity = '1';
        // subtle movement
        card.style.transform = `translate(${side === 'left' ? '20px' : '-20px'}, -20px)`;
        
        setTimeout(() => {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 1000);
        }, 3000);
    }
    
    drawSignalGraph(energy) {
        const ctx = this.signalCtx;
        const w = this.signalCanvas.width;
        const h = this.signalCanvas.height;
        
        // Update history
        this.signalHistory.push(energy);
        if(this.signalHistory.length > w / 4) this.signalHistory.shift(); 
        
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < this.signalHistory.length; i++) {
            const val = this.signalHistory[i];
            const y = h - (val / 255) * h;
            const x = i * 4;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    
    drawPeakGraph(freqData) {
        const ctx = this.peakCtx;
        const w = this.peakCanvas.width;
        const h = this.peakCanvas.height;
        
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FFFFFF';
        
        const barWidth = (w / freqData.length) * 2.5;
        let x = 0;
        
        for (let i = 0; i < freqData.length / 2; i += 2) {
            const barHeight = (freqData[i] / 255) * h;
            ctx.fillRect(x, h - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    isCinematicMode() {
        return this.isCinematic;
    }

    resetToFullUI() {
        this.isCinematic = false;
        this.inactivityTimer = 0;
        this.updateCinematicState();
    }

    updateCinematicState() {
        const fadeElements = document.querySelectorAll('.cinematic-fade');
        if (this.isCinematic) {
            fadeElements.forEach(el => el.classList.add('cinematic-hidden'));
            this.statusBadge.textContent = "IMMERSION MODE";
            this.statusBadge.style.borderColor = "#00F0FF";
        } else {
            fadeElements.forEach(el => el.classList.remove('cinematic-hidden'));
            this.statusBadge.textContent = "SYSTEM READY";
            this.statusBadge.style.borderColor = "rgba(255,255,255,0.15)";
        }
    }

    update(dt) {
        if (!this.audioManager) return;

        const energy = this.audioManager.getAverageFrequency();
        const freqData = this.audioManager.getFrequencyData();
        
        // Update Stats UI
        this.signalVal.textContent = Math.round((energy / 255) * 100) + '%';
        
        // Find Peak
        let maxVal = 0;
        let maxIndex = 0;
        for(let i=0; i<freqData.length; i++) {
            if(freqData[i] > maxVal) {
                maxVal = freqData[i];
                maxIndex = i;
            }
        }
        const nyquist = this.audioManager.ctx.sampleRate / 2;
        const freq = Math.round(maxIndex * (nyquist / freqData.length));
        this.peakVal.textContent = freq + ' Hz';

        // Draw Canvases
        this.drawSignalGraph(energy);
        this.drawPeakGraph(freqData);

        // Strategic Floating Cards
        // Reduced frequency as requested
        const treble = this.audioManager.getBandEnergy('treble');
        const bass = this.audioManager.getBandEnergy('bass');
        
        if (this.audioManager.isBeat && bass > 150) {
            if(Math.random() < 0.1) this.spawnFloatingCard('bass'); // Was 0.4
        } else if (treble > 180) {
            if(Math.random() < 0.02) this.spawnFloatingCard('treble'); // Was 0.1
        } else if (Math.random() < 0.001) { // Was 0.005
            this.spawnFloatingCard('random');
        }

        // Notification System Loop
        this.timeSinceLastPopup += dt;
        if (this.timeSinceLastPopup > this.popupInterval) {
             const msg = this.popups[Math.floor(Math.random() * this.popups.length)];
             // Only show notifications if in Full UI mode (optional, but less cluttered)
             if (!this.isCinematic) {
                 this.triggerNotification(msg);
             }
             this.timeSinceLastPopup = 0;
        }

        // Cinematic Mode Logic (Auto-Hide & Auto-Reappear)
        if (this.isPlaying) {
            if (!this.isCinematic) {
                // Active mode: Check for inactivity to hide
                this.inactivityTimer += dt;
                this.hiddenTimer = 0;
                
                if (this.inactivityTimer > this.INACTIVITY_THRESHOLD) {
                    this.isCinematic = true;
                    this.updateCinematicState();
                }
            } else {
                // Hidden mode: Check timer to reappear
                this.hiddenTimer += dt;
                this.inactivityTimer = 0;
                
                if (this.hiddenTimer > this.REAPPEAR_INTERVAL) {
                    this.resetToFullUI();
                }
            }
        }
        
        // High energy reaction for Play Button
        if (energy > 200 && !this.isCinematic) {
            this.playBtn.style.boxShadow = `0 0 ${energy/5}px rgba(255,255,255,0.5)`;
        } else {
            this.playBtn.style.boxShadow = 'none';
        }
    }
}
