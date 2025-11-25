export class RecorderManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.onRecordingComplete = null;
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.animationFrameId = null;
        this.stream = null;
        this.audioStream = null;
    }

    async startRecording(canvasElement, audioStream, trackTitle = 'recording') {
        if (this.isRecording) {
            console.warn('Already recording');
            return;
        }

        try {
            // Create a composite canvas at 1080p (1920x1080)
            this.compositeCanvas = document.createElement('canvas');
            this.compositeCanvas.width = 1920;
            this.compositeCanvas.height = 1080;
            this.compositeCtx = this.compositeCanvas.getContext('2d', { 
                alpha: false,
                desynchronized: true,
                willReadFrequently: false
            });

            // Store references
            this.sourceCanvas = canvasElement;
            this.audioStream = audioStream;
            this.trackTitle = trackTitle;

            // Start capturing the composite canvas
            this.isRecording = true; // Set flag early for render loop
            this.captureComposite();

            // Get video stream from composite canvas at 60fps
            const videoStream = this.compositeCanvas.captureStream(60);
            
            // Combine video and audio tracks
            this.stream = new MediaStream();
            
            videoStream.getVideoTracks().forEach(track => {
                this.stream.addTrack(track);
            });
            
            audioStream.getAudioTracks().forEach(track => {
                this.stream.addTrack(track);
            });

            // Determine supported mime type
            const options = this.getOptimalRecordingOptions();
            
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                this.stopRecording();
            };

            // Start recording
            this.mediaRecorder.start(100); // 100ms chunks
            console.log(`Recording started: ${options.mimeType} @ 1920x1080`);
            
        } catch (err) {
            console.error('Failed to start recording:', err);
            this.isRecording = false;
            this.stopCompositeCapture();
        }
    }

    getOptimalRecordingOptions() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return {
                    mimeType: type,
                    videoBitsPerSecond: 15000000, // 15 Mbps
                    audioBitsPerSecond: 320000    // 320 Kbps
                };
            }
        }

        console.warn('No preferred mime type supported, using defaults');
        return {
            videoBitsPerSecond: 8000000,
            audioBitsPerSecond: 128000
        };
    }

    captureComposite() {
        const render = () => {
            if (!this.isRecording || !this.compositeCtx || !this.sourceCanvas) return;

            const ctx = this.compositeCtx;
            const width = 1920;
            const height = 1080;

            // Fill background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Draw source canvas (contain/fit logic to preserve aspect ratio)
            const sWidth = this.sourceCanvas.width;
            const sHeight = this.sourceCanvas.height;
            const sAspect = sWidth / sHeight;
            const dAspect = width / height;

            let dDrawW, dDrawH, dx, dy;

            if (sAspect > dAspect) {
                // Source is wider, fit to width
                dDrawW = width;
                dDrawH = width / sAspect;
                dx = 0;
                dy = (height - dDrawH) / 2;
            } else {
                // Source is taller, fit to height
                dDrawH = height;
                dDrawW = height * sAspect;
                dy = 0;
                dx = (width - dDrawW) / 2;
            }

            // We want to "cover" the area to avoid black bars if possible, or just draw centered
            // Current logic: "Letterbox" (fit within). 
            // If we want "Cover" (fill screen), flip the comparison:
            /*
            if (sAspect > dAspect) {
                // Source is wider, match height to crop sides
                dDrawH = height;
                dDrawW = height * sAspect;
                dy = 0;
                dx = (width - dDrawW) / 2;
            } else {
                // Source is taller, match width to crop top/bottom
                dDrawW = width;
                dDrawH = width / sAspect;
                dx = 0;
                dy = (height - dDrawH) / 2;
            }
            */
            // Let's stick to "Letterbox" (Contain) for now to ensure all UI is visible, 
            // or just stretch if close enough? 
            // Actually, the visualizer is fullscreen, so it should match window aspect.
            // Let's just draw it full for now as per original code but safer.
            ctx.drawImage(this.sourceCanvas, 0, 0, width, height);

            // Draw UI elements
            this.drawUIElements();

            this.animationFrameId = requestAnimationFrame(render);
        };

        render();
    }

    drawUIElements() {
        if (!this.compositeCtx) return;
        const ctx = this.compositeCtx;
        
        // Helper for text
        const drawText = (text, x, y, font, color, align = 'left') => {
            ctx.fillStyle = color;
            ctx.font = font;
            ctx.textAlign = align;
            ctx.fillText(text, x, y);
        };

        // Logo
        drawText('SONIC VOYAGER', 60, 50, 'bold 28px Orbitron, sans-serif', '#FFFFFF');

        // Safe access to DOM elements
        const getElemText = (id) => {
            const el = document.getElementById(id);
            return el ? el.textContent : '';
        };

        const isHidden = (id) => {
            const el = document.getElementById(id);
            return !el || el.closest('.cinematic-hidden');
        };

        // Stats
        if (!isHidden('signal-card')) {
            this.drawStatCard(ctx, 60, 150, 'SIGNAL INTENSITY', 
                getElemText('signal-val') || '0%',
                document.getElementById('signal-canvas'));
        }

        if (!isHidden('peak-card')) {
            this.drawStatCard(ctx, 60, 350, 'PEAK FREQ', 
                getElemText('peak-val') || '0 Hz',
                document.getElementById('peak-canvas'));
        }

        // Track List
        if (!isHidden('track-container')) {
            this.drawTrackList(ctx);
        }

        // Controls
        if (!isHidden('controls-container')) {
            this.drawPlayerControls(ctx);
        }

        // Floating Cards
        this.drawFloatingCards(ctx);

        // Notification
        this.drawNotification(ctx);
    }

    drawStatCard(ctx, x, y, label, value, canvas) {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, 450, 180);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 450, 180);

        ctx.fillStyle = '#888888';
        ctx.font = '14px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 40, y + 40);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px "Share Tech Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(value, x + 410, y + 35);
        ctx.textAlign = 'left'; // Reset

        if (canvas) {
            try {
                ctx.drawImage(canvas, x + 40, y + 90, 370, 60);
            } catch (e) {
                // Ignore if canvas not ready
            }
        }
    }

    drawTrackList(ctx) {
        const x = 1920 - 460;
        const y = 150;
        const width = 400;
        const height = 800;

        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, width, 60);
        ctx.beginPath();
        ctx.moveTo(x, y + 60);
        ctx.lineTo(x + width, y + 60);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Orbitron, sans-serif';
        ctx.fillText('SEQUENCE QUEUE', x + 40, y + 25);

        const trackItems = document.querySelectorAll('.track-item');
        let offsetY = y + 90;
        
        trackItems.forEach((item) => {
            if (offsetY > y + height - 80) return;

            const isActive = item.classList.contains('active');
            
            if (isActive) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x + 25, offsetY, width - 50, 60);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(x + 25, offsetY, width - 50, 60);
            }

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

        ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        ctx.fillRect(x, y, width, 140);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(x, y, width, 140);

        // Play button
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x + 70, y + 70, 32, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶', x + 70, y + 60); // Force play icon for recording
        ctx.textAlign = 'left';

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
                ctx.textAlign = 'left';
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
            ctx.textAlign = 'left';
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
        this.compositeCtx = null;
        this.compositeCanvas = null;
        this.sourceCanvas = null;
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        } else {
            // Safety cleanup if stop called but recorder inactive
            this.isRecording = false;
            this.stopCompositeCapture();
        }
    }

    handleStop() {
        this.isRecording = false;
        this.stopCompositeCapture();
        
        if (this.recordedChunks.length > 0) {
            this.downloadRecording();
        } else {
            console.warn('No data recorded');
        }
        
        // Notify completion
        if (this.onRecordingComplete) {
            this.onRecordingComplete();
        }
    }

    downloadRecording() {
        const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder.mimeType
        });

        const extension = this.mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `${this.trackTitle}_${Date.now()}.${extension}`;
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.recordedChunks = [];
        }, 100);
    }

    getIsRecording() {
        return this.isRecording;
    }
}
