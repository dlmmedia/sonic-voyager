import * as THREE from 'three';

export class EnergyPulse {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.rings = [];
    }

    init() {
        // Concentric Rings that expand
        const ringCount = 10;
        const geometry = new THREE.TorusGeometry(1, 0.05, 16, 100);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        for(let i=0; i<ringCount; i++) {
            const ring = new THREE.Mesh(geometry, material.clone());
            ring.scale.set(1 + i*2, 1 + i*2, 1);
            this.rings.push(ring);
            this.group.add(ring);
        }
        
        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        // Pulse rings outward
        this.rings.forEach((ring, i) => {
            // Scale expansion
            let scale = ring.scale.x + 0.05 + (energy.bass / 255) * 0.1;
            if (scale > 30) scale = 1;
            ring.scale.set(scale, scale, 1);
            
            // Opacity fade out at edges
            const opacity = 1 - (scale / 30);
            ring.material.opacity = opacity;
            
            // Color based on frequency band
            if (i % 3 === 0) { // Bass
                const c = energy.bass / 255;
                ring.material.color.setRGB(c, 0, 0);
            } else if (i % 3 === 1) { // Mid
                const c = energy.mid / 255;
                ring.material.color.setRGB(0, c, 0);
            } else { // Treble
                const c = energy.treble / 255;
                ring.material.color.setRGB(0, 0, c);
            }
        });
        
        // Rotate group
        this.group.rotation.x = Math.sin(time * 0.5) * 0.5;
        this.group.rotation.y = time * 0.2;
    }

    dispose() {
        this.scene.remove(this.group);
        this.rings.forEach(r => {
            r.geometry.dispose();
            r.material.dispose();
        });
        this.rings = [];
    }
}

