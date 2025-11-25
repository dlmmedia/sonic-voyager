import * as THREE from 'three';

export class CircularWave {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.rings = [];
        this.ringCount = 32;
    }

    init() {
        for (let i = 0; i < this.ringCount; i++) {
            const geometry = new THREE.RingGeometry(i * 0.5 + 1, i * 0.5 + 1.1, 64);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.3
            });
            const mesh = new THREE.Mesh(geometry, material);
            this.group.add(mesh);
            this.rings.push(mesh);
        }
        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        // Map frequency data to rings
        // Inner rings = bass, Outer rings = treble
        
        const binSize = Math.floor(freqData.length / this.ringCount);

        this.rings.forEach((ring, i) => {
            // Get average energy for this ring's frequency band
            let sum = 0;
            for (let j = 0; j < binSize; j++) {
                sum += freqData[i * binSize + j];
            }
            const avg = sum / binSize;
            const val = avg / 255;

            // Scale/Position Z based on value
            ring.position.z = val * 5;
            ring.rotation.z = time * (i % 2 === 0 ? 0.2 : -0.2);
            
            // Color mapping
            ring.material.color.setHSL((i / this.ringCount) + (time * 0.1), 1, 0.5 + val * 0.5);
            ring.material.opacity = 0.1 + val;

            // Pulse effect on beat
            if (energy.isBeat && i < 5) {
                ring.scale.setScalar(1 + val * 0.5);
            } else {
                ring.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
            }
        });

        this.group.rotation.x = Math.sin(time * 0.5) * 0.2;
        this.group.rotation.y = Math.cos(time * 0.3) * 0.2;
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
