import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GridTunnel } from './presets/GridTunnel.js';
import { PentagonalCore } from './presets/PentagonalCore.js';
import { CircularWave } from './presets/CircularWave.js';
import { CosmicVoyage } from './presets/CosmicVoyage.js';
import { NeonCity } from './presets/NeonCity.js';
import { EtherealAura } from './presets/EtherealAura.js';
import { DarkMatter } from './presets/DarkMatter.js';
import { EnergyPulse } from './presets/EnergyPulse.js';
import { ChromeCadenceVisual } from './presets/ChromeCadenceVisual.js';

export class Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 30;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.initPostProcessing();

        this.presets = {
            'Grid': new GridTunnel(this.scene),
            'Pentagon': new PentagonalCore(this.scene),
            'Wave': new CircularWave(this.scene),
            'Cosmic': new CosmicVoyage(this.scene),
            'Neon': new NeonCity(this.scene),
            'Ethereal': new EtherealAura(this.scene),
            'Dark': new DarkMatter(this.scene),
            'Energy': new EnergyPulse(this.scene),
            'Chrome': new ChromeCadenceVisual(this.scene)
        };
        
        this.activePreset = this.presets['Grid'];
        this.activePreset.init();

        window.addEventListener('resize', this.onResize.bind(this));
    }

    initPostProcessing() {
        try {
            this.composer = new EffectComposer(this.renderer);
            
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);

            // Bloom for the neon glow
            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                1.5, // strength
                0.4, // radius
                0.85 // threshold
            );
            this.composer.addPass(this.bloomPass);

            // Film grain for cinematic feel
            this.filmPass = new FilmPass(
                0.35,   // noise intensity
                0.025,  // scanline intensity
                648,    // scanline count
                false   // grayscale
            );
            this.composer.addPass(this.filmPass);

            // Output Pass for correct color management
            this.outputPass = new OutputPass();
            this.composer.addPass(this.outputPass);

        } catch (e) {
            console.error("Post-processing initialization failed:", e);
            this.composer = null;
            this.bloomPass = null;
            this.filmPass = null;
        }
    }

    setPreset(name) {
        if (this.presets[name] && this.presets[name] !== this.activePreset) {
            this.activePreset.dispose();
            this.activePreset = this.presets[name];
            this.activePreset.init();
        }
    }

    setTrackInfo(track) {
        if (this.activePreset && typeof this.activePreset.setArtwork === 'function') {
            this.activePreset.setArtwork(track.art);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    render(audioManager, isCinematic) {
        // Get audio data
        const freqData = audioManager.getFrequencyData();
        const waveData = audioManager.getWaveformData();
        const isBeat = audioManager.isBeat;
        const bassEnergy = audioManager.getBandEnergy('bass');
        const midEnergy = audioManager.getBandEnergy('mid');
        const trebleEnergy = audioManager.getBandEnergy('treble');

        // Camera Logic
        const time = performance.now() / 1000;
        
        // Calculate target base positions
        let targetZ = 30;
        let targetX = 0;

        if (isCinematic) {
            // Slow zoom in/out
            targetZ = 30 + Math.sin(time * 0.1) * 15; 
            targetX = Math.sin(time * 0.05) * 5;
        } else {
            // Return to default
            targetZ = 30;
            targetX = 0;
        }

        // Smoothly move camera to target
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZ, 0.05);
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, 0.05);
        
        // Camera Shake on Beat
        if (isBeat) {
            const shakeIntensity = 0.4;
            this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        } else {
            // Smoothly return Y to center
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 0, 0.1);
        }
        
        this.camera.lookAt(0, 0, 0);

        // Update active preset
        if (this.activePreset) {
            this.activePreset.update(freqData, waveData, {
                isBeat,
                bass: bassEnergy,
                mid: midEnergy,
                treble: trebleEnergy
            }, time);
        }

        // Post-processing updates
        if (this.composer) {
            try {
                if (this.bloomPass) {
                    // Dynamic bloom strength based on bass
                    this.bloomPass.strength = 1.2 + (bassEnergy / 255) * 0.8;
                    this.bloomPass.radius = 0.4 + (midEnergy / 255) * 0.2;
                }

                if (this.filmPass) {
                    // Subtle noise shift
                    this.filmPass.uniforms.time.value = time;
                    // Increase static on heavy beats slightly
                    this.filmPass.uniforms.nIntensity.value = 0.35 + (isBeat ? 0.1 : 0);
                }

                this.composer.render();
            } catch (e) {
                console.error("Render failed with post-processing, falling back:", e);
                this.composer = null; // Disable composer to avoid spamming errors
                this.renderer.render(this.scene, this.camera);
            }
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    getCanvasStream(fps = 60) {
        return this.renderer.domElement.captureStream(fps);
    }

    getCanvasElement() {
        return this.renderer.domElement;
    }
}
