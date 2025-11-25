import * as THREE from 'three';
import { GridTunnel } from './presets/GridTunnel.js';
import { PentagonalCore } from './presets/PentagonalCore.js';
import { CircularWave } from './presets/CircularWave.js';
import { CosmicVoyage } from './presets/CosmicVoyage.js';

export class Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 30;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.presets = {
            'Grid': new GridTunnel(this.scene),
            'Pentagon': new PentagonalCore(this.scene),
            'Wave': new CircularWave(this.scene),
            'Cosmic': new CosmicVoyage(this.scene)
        };
        
        this.activePreset = this.presets['Grid'];
        this.activePreset.init();

        window.addEventListener('resize', this.onResize.bind(this));
    }

    setPreset(name) {
        if (this.presets[name] && this.presets[name] !== this.activePreset) {
            this.activePreset.dispose();
            this.activePreset = this.presets[name];
            this.activePreset.init();
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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
        if (isCinematic) {
            // Slow zoom in/out
            this.camera.position.z = 30 + Math.sin(time * 0.1) * 15; 
            this.camera.position.x = Math.sin(time * 0.05) * 5;
            this.camera.lookAt(0, 0, 0);
        } else {
            // Return to default
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 30, 0.05);
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, 0, 0.05);
            this.camera.lookAt(0, 0, 0);
        }

        // Update active preset
        if (this.activePreset) {
            this.activePreset.update(freqData, waveData, {
                isBeat,
                bass: bassEnergy,
                mid: midEnergy,
                treble: trebleEnergy
            }, time);
        }

        this.renderer.render(this.scene, this.camera);
    }

    getCanvasStream(fps = 60) {
        return this.renderer.domElement.captureStream(fps);
    }

    getCanvasElement() {
        return this.renderer.domElement;
    }
}
