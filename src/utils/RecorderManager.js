export class RecorderManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.onRecordingComplete = null;
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.animationFrameId = null;
    }

    async startRecording(canvasElement, audioStream, trackTitle = 'recording') {
        if (this.isRecording) {
            console.warn('Already recording');
            return;
        }

        // Create a composite canvas at 1080p (1920x1080)
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = 1920;
        this.compositeCanvas.height = 1080;
        this.compositeCtx = this.compositeCanvas.getContext('2d', { 
            alpha: false,
            desynchronized: true 
        });

        // Start capturing the composite canvas
        this.captureComposite(canvasElement);

        // Get video stream from composite canvas at 60fps
        const videoStream = this.compositeCanvas.captureStream(60);

        // Combine video and audio tracks
        const combinedStream = new MediaStream();
        
        // Add video tracks
        videoStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });
        
        // Add audio tracks
        audioStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
        });

        // Determine supported mime type with high quality settings
        let mimeType;
        const options = {};
        
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            mimeType = 'video/webm;codecs=vp9,opus';
            options.mimeType = mimeType;
            options.videoBitsPerSecond = 15000000; // 15 Mbps for 1080p
            options.audioBitsPerSecond = 320000;   // 320 kbps
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            mimeType = 'video/webm;codecs=vp8,opus';
            options.mimeType = mimeType;
            options.videoBitsPerSecond = 15000000;
            options.audioBitsPerSecond = 320000;
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
            options.mimeType = mimeType;
            options.videoBitsPerSecond = 15000000;
            options.audioBitsPerSecond = 320000;
        } else {
            console.warn('No supported video format found, using default');
        }

        this.recordedChunks = [];
        this.trackTitle = trackTitle;
        this.mediaRecorder = new MediaRecorder(combinedStream, options);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.isRecording = false;
            this.stopCompositeCapture();
            this.downloadRecording();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            this.isRecording = false;
            this.stopCompositeCapture();
        };

        this.mediaRecorder.start(100); // Collect data every 100ms
        this.isRecording = true;
        
        console.log('Recording started with mime type:', mimeType, 'at 1920x1080');
    }

    captureComposite(canvasElement) {
        const render = () => {
            if (!this.isRecording) return;

            // Clear composite canvas
            this.compositeCtx.fillStyle = '#000000';
            this.compositeCtx.fillRect(0, 0, 1920, 1080);

            // Draw the Three.js canvas (scaled to fit 1920x1080)
            this.compositeCtx.drawImage(canvasElement, 0, 0, 1920, 1080);

            // Capture UI elements by drawing them on top
            this.drawUIElements();

            this.animationFrameId = requestAnimationFrame(render);
        };

        render();
    }

    drawUIElements() {
        const ctx = this.compositeCtx;
        
        // Set up text rendering
        ctx.textBaseline = 'top';
        
        // Scale factor for positioning (assuming original design is for ~1920x1080)
        const scale = 1920 / window.innerWidth;

        // Draw logo (top left)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Orbitron, sans-serif';
        ctx.fillText('SONIC VOYAGER', 60, 50);

        // Draw status badge (top right)
        const statusBadge = document.getElementById('mode-display');
        if (statusBadge && !statusBadge.closest('.cinematic-hidden')) {
            ctx.font = '16px "Share Tech Mono", monospace';
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            const badgeText = statusBadge.textContent;
            const badgeWidth = ctx.measureText(badgeText).width + 24;
            ctx.strokeRect(1920 - badgeWidth - 60, 45, badgeWidth, 30);
            ctx.fillText(badgeText, 1920 - badgeWidth - 48, 53);
        }

        // Draw stats cards (left side)
        const signalCard = document.getElementById('signal-card');
        const peakCard = document.getElementById('peak-card');
        
        if (signalCard && !signalCard.closest('.cinematic-hidden')) {
            this.drawStatCard(ctx, 60, 150, 'SIGNAL INTENSITY', 
                document.getElementById('signal-val')?.textContent || '0%',
                document.getElementById('signal-canvas'));
        }

        if (peakCard && !peakCard.closest('.cinematic-hidden')) {
            this.drawStatCard(ctx, 60, 350, 'PEAK FREQ', 
                document.getElementById('peak-val')?.textContent || '0 Hz',
                document.getElementById('peak-canvas'));
        }

        // Draw track list (right side)
        const trackContainer = document.getElementById('track-container');
        if (trackContainer && !trackContainer.closest('.cinematic-hidden')) {
            this.drawTrackList(ctx);
        }

        // Draw player controls (bottom)
        const controlsContainer = document.getElementById('controls-container');
        if (controlsContainer && !controlsContainer.closest('.cinematic-hidden')) {
            this.drawPlayerControls(ctx);
        }

        // Draw floating cards
        this.drawFloatingCards(ctx);

        // Draw notification overlay
        this.drawNotification(ctx);
    }

    drawStatCard(ctx, x, y, label, value, canvas) {
        // Card background
        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, 450, 180);
        
        // Card border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 450, 180);

        // Label
        ctx.fillStyle = '#888888';
        ctx.font = '14px Orbitron, sans-serif';
        ctx.fillText(label, x + 40, y + 40);

        // Value
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px "Share Tech Mono", monospace';
        const valueWidth = ctx.measureText(value).width;
        ctx.fillText(value, x + 450 - valueWidth - 40, y + 35);

        // Mini visualizer (if canvas exists)
        if (canvas) {
            ctx.drawImage(canvas, x + 40, y + 90, 370, 60);
        }
    }

    drawTrackList(ctx) {
        const x = 1920 - 460;
        const y = 150;
        const width = 400;
        const height = 800;

        // Card background
        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, width, height);
        
        // Card border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Header
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, width, 60);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(x, y + 60);
        ctx.lineTo(x + width, y + 60);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Orbitron, sans-serif';
        ctx.fillText('SEQUENCE QUEUE', x + 40, y + 25);

        // Track items
        const trackItems = document.querySelectorAll('.track-item');
        let offsetY = y + 90;
        
        trackItems.forEach((item, index) => {
            if (offsetY > y + height - 80) return; // Don't overflow

            const isActive = item.classList.contains('active');
            
            // Track background
            if (isActive) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x + 25, offsetY, width - 50, 60);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(x + 25, offsetY, width - 50, 60);
            }

            // Track text
            const titleEl = item.querySelector('.track-title');
            const genreEl = item.querySelector('.track-genre');
            
            if (titleEl) {
                ctx.fillStyle = isActive ? '#000000' : '#FFFFFF';
                ctx.font = 'bold 14px Rajdhani, sans-serif';
                ctx.fillText(titleEl.textContent.substring(0, 25), x + 40, offsetY + 15);
            }
            
            if (genreEl) {
                ctx.fillStyle = isActive ? 'rgba(0,0,0,0.6)' : '#888888';
                ctx.font = '12px "Share Tech Mono", monospace';
                ctx.fillText(genreEl.textContent, x + 40, offsetY + 35);
            }

            offsetY += 70;
        });
    }

    drawPlayerControls(ctx) {
        const y = 1080 - 180;
        const x = 60;
        const width = 1100;

        // Card background
        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, width, 140);
        
        // Card border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, 140);

        // Play button circle
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + 70, y + 70, 32, 0, Math.PI * 2);
        ctx.stroke();

        // Play/Pause icon
        const playBtn = document.getElementById('play-btn');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px sans-serif';
        ctx.fillText(playBtn?.textContent || '▶', x + 60, y + 60);

        // Now playing info
        const titleEl = document.getElementById('current-track-title');
        const artistEl = document.getElementById('current-track-artist');
        
        ctx.fillStyle = '#888888';
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.fillText('Now Transmitting', x + 250, y + 35);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Orbitron, sans-serif';
        ctx.fillText(titleEl?.textContent.substring(0, 30) || 'SELECT TRACK', x + 250, y + 55);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.fillText(artistEl?.textContent || '--', x + 250, y + 90);
    }

    drawFloatingCards(ctx) {
        const floatingCards = document.querySelectorAll('.floating-card');
        
        floatingCards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const opacity = parseFloat(window.getComputedStyle(card).opacity) || 0;
            
            if (opacity > 0.1) {
                const x = (rect.left / window.innerWidth) * 1920;
                const y = (rect.top / window.innerHeight) * 1080;
                
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(x, y, 300, 40);
                
                ctx.strokeStyle = card.style.borderLeftColor || '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 40);
                ctx.stroke();
                
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '14px "Share Tech Mono", monospace';
                ctx.fillText(card.textContent, x + 20, y + 22);
                ctx.restore();
            }
        });
    }

    drawNotification(ctx) {
        const notifOverlay = document.getElementById('notification-overlay');
        if (notifOverlay && notifOverlay.classList.contains('visible')) {
            const x = 1920 - 400;
            const y = 1080 - 250;
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x, y, 360, 80);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, 360, 80);
            
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 80);
            ctx.stroke();
            
            const titleEl = document.getElementById('notif-title');
            const textEl = document.getElementById('notif-text');
            
            ctx.fillStyle = '#888888';
            ctx.font = '12px Orbitron, sans-serif';
            ctx.fillText(titleEl?.textContent || '', x + 20, y + 20);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '16px Rajdhani, sans-serif';
            ctx.fillText(textEl?.textContent || '', x + 20, y + 45);
        }
    }

    stopCompositeCapture() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.compositeCanvas = null;
        this.compositeCtx = null;
    }

    stopRecording() {
        console.log('stopRecording called, isRecording:', this.isRecording);
        console.log('recordedChunks length:', this.recordedChunks.length);
        
        if (this.mediaRecorder && this.isRecording) {
            console.log('Stopping MediaRecorder, state:', this.mediaRecorder.state);
            this.mediaRecorder.stop();
        }
    }

    downloadRecording() {
        console.log('downloadRecording called, chunks:', this.recordedChunks.length);
        
        if (this.recordedChunks.length === 0) {
            console.warn('No recorded data to download');
            return;
        }

        const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder.mimeType || 'video/webm'
        });

        console.log('Blob created, size:', blob.size, 'bytes');

        // Determine file extension
        const extension = this.mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
        const filename = `${this.trackTitle}.${extension}`;
        
        console.log('Downloading file:', filename);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        console.log('Download triggered');
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Cleanup complete');
        }, 100);

        console.log(`Recording downloaded: ${filename}`);
        
        // Notify completion
        if (this.onRecordingComplete) {
            this.onRecordingComplete();
        }

        this.recordedChunks = [];
    }

    getIsRecording() {
        return this.isRecording;
    }
}

