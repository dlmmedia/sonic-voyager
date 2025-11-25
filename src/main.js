import { AudioManager } from './audio/AudioManager.js';
import { Visualizer } from './visuals/Visualizer.js';
import { UIManager } from './ui/UIManager.js';

class App {
    constructor() {
        this.audioManager = new AudioManager();
        this.visualizer = new Visualizer('canvas-container');
        this.uiManager = new UIManager(this.audioManager, this.visualizer);

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    animate() {
        const dt = 1/60; // Approx delta time
        this.audioManager.update();
        
        // Check UI state for cinematic mode
        const isCinematic = this.uiManager.isCinematicMode();
        this.visualizer.render(this.audioManager, isCinematic);
        
        this.uiManager.update(dt);

        requestAnimationFrame(this.animate);
    }
}

new App();
