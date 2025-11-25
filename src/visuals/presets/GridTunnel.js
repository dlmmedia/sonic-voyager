import * as THREE from 'three';

export class GridTunnel {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.group = new THREE.Group();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(100, 100, 50, 50);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.5 
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = -10;
        
        this.group.add(this.mesh);
        
        // Add a second mirrored grid on top
        this.topMesh = this.mesh.clone();
        this.topMesh.position.y = 10;
        this.topMesh.rotation.x = Math.PI / 2;
        this.group.add(this.topMesh);

        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        if (!this.mesh) return;

        // Warp the grid based on frequency data
        const positions = this.mesh.geometry.attributes.position;
        const count = positions.count;
        
        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i); // This is actually Z in world space because of rotation
            
            // Create a moving wave effect
            // Map frequency data to height
            // freqData has 1024 bins. We can map vertex index to bin index.
            const freqIndex = Math.abs(Math.floor((x + 50) % 100) * 10) % freqData.length;
            const value = freqData[freqIndex] / 255;
            
            // Z-displacement
            let z = Math.sin(x * 0.2 + time * 2) * 2 + Math.cos(y * 0.2 + time) * 2;
            z += value * 5 * (energy.bass / 255); // Bass makes it spike more

            positions.setZ(i, z);
        }
        
        positions.needsUpdate = true;
        
        // Rotate the tunnel slightly
        this.group.rotation.z = Math.sin(time * 0.1) * 0.1;
        
        // Color pulse on beat
        if (energy.isBeat) {
            this.mesh.material.color.setHSL(Math.random(), 1, 0.5);
            this.topMesh.material.color.copy(this.mesh.material.color);
        } else {
            // Fade back to cyan
            const currentHSL = {};
            this.mesh.material.color.getHSL(currentHSL);
            this.mesh.material.color.setHSL(currentHSL.h, currentHSL.s, Math.max(0.5, currentHSL.l * 0.95));
            this.topMesh.material.color.copy(this.mesh.material.color);
        }
    }

    dispose() {
        this.scene.remove(this.group);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.topMesh.geometry.dispose();
        this.topMesh.material.dispose();
    }
}
