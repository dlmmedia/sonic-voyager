import * as THREE from 'three';

export class DarkMatter {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.sphere = null;
        this.shards = null;
    }

    init() {
        // 1. Distorted Sphere (The "Core")
        const geometry = new THREE.IcosahedronGeometry(10, 4); // Detailed sphere
        const material = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.4,
            metalness: 0.8,
            emissive: 0x330000,
            emissiveIntensity: 0.2,
            wireframe: true
        });
        
        this.sphere = new THREE.Mesh(geometry, material);
        this.group.add(this.sphere);

        // 2. Floating Shards (Orbiting debris)
        const shardsGeo = new THREE.BufferGeometry();
        const count = 500;
        const pos = new Float32Array(count * 3);
        
        for(let i=0; i<count; i++) {
            const r = 15 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i*3+2] = r * Math.cos(phi);
        }
        shardsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        
        const shardsMat = new THREE.PointsMaterial({
            color: 0xff0000,
            size: 0.5,
            blending: THREE.AdditiveBlending
        });
        
        this.shards = new THREE.Points(shardsGeo, shardsMat);
        this.group.add(this.shards);

        // Add lights for standard material
        const pointLight = new THREE.PointLight(0xff0000, 2, 50);
        pointLight.position.set(0, 0, 0);
        this.group.add(pointLight);

        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        // Deform sphere based on bass
        const bassScale = 1 + (energy.bass / 255) * 0.5;
        this.sphere.scale.set(bassScale, bassScale, bassScale);
        
        // Rotate chaos
        this.group.rotation.x += 0.005;
        this.group.rotation.y += 0.01;
        
        // Glitch effect on beat
        if (energy.isBeat) {
            this.sphere.material.wireframe = !this.sphere.material.wireframe;
            this.sphere.material.emissive.setHex(0xff0000);
        } else {
            this.sphere.material.wireframe = true;
            this.sphere.material.emissive.lerp(new THREE.Color(0x110000), 0.1);
        }

        // Update shards
        const positions = this.shards.geometry.attributes.position.array;
        for(let i=0; i<positions.length; i+=3) {
            // Orbit logic could go here, simple rotation handled by group
            // Jitter positions on high treble
            if (energy.treble > 150) {
                positions[i] += (Math.random() - 0.5) * 0.5;
                positions[i+1] += (Math.random() - 0.5) * 0.5;
                positions[i+2] += (Math.random() - 0.5) * 0.5;
            }
        }
        this.shards.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.group);
        this.sphere.geometry.dispose();
        this.sphere.material.dispose();
        this.shards.geometry.dispose();
        this.shards.material.dispose();
    }
}

