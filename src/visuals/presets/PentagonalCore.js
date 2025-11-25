import * as THREE from 'three';

export class PentagonalCore {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.shapes = [];
    }

    init() {
        // Create nested Icosahedrons
        for (let i = 0; i < 5; i++) {
            const geometry = new THREE.IcosahedronGeometry(2 + i * 3, 0); // Low poly
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(i / 5, 1, 0.5),
                wireframe: true,
                transparent: true,
                opacity: 0.6
            });
            const mesh = new THREE.Mesh(geometry, material);
            this.group.add(mesh);
            this.shapes.push({ mesh, originalScale: 1, speed: (i + 1) * 0.2 });
        }
        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        // Rotate entire group
        this.group.rotation.y += 0.005;
        this.group.rotation.x += 0.002;

        this.shapes.forEach((shape, index) => {
            // Rotate individual shapes
            shape.mesh.rotation.z += shape.speed * 0.01;
            shape.mesh.rotation.y -= shape.speed * 0.01;

            // Scale based on specific frequency bands
            // Outer shapes (higher index) react to lower freq (bass)
            // Inner shapes react to high freq
            
            let reactionFactor = 0;
            if (index < 2) {
                reactionFactor = energy.treble / 255;
            } else if (index < 4) {
                reactionFactor = energy.mid / 255;
            } else {
                reactionFactor = energy.bass / 255;
            }

            const targetScale = 1 + reactionFactor * 2; // Scale up to 3x
            
            // Smooth scaling
            shape.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
            
            // Change color on beat
            if (energy.isBeat && index === 4) { // Outer shell flashes on beat
                shape.mesh.material.color.setHSL(Math.random(), 1, 0.8);
            } else {
                shape.mesh.material.color.lerp(new THREE.Color().setHSL(index/5, 1, 0.5), 0.05);
            }
        });
    }

    dispose() {
        this.scene.remove(this.group);
        this.shapes.forEach(s => {
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        this.shapes = [];
    }
}
