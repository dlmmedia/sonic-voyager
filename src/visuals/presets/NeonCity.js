import * as THREE from 'three';

export class NeonCity {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.buildings = [];
        this.grid = null;
        this.sun = null;
    }

    init() {
        // 1. Retro Grid
        const gridHelper = new THREE.GridHelper(200, 40, 0xff00ff, 0x00ffff);
        gridHelper.position.y = -10;
        gridHelper.position.z = -50;
        gridHelper.scale.z = 5;
        this.grid = gridHelper;
        this.group.add(gridHelper);

        // 2. Neon Sun
        const sunGeo = new THREE.CircleGeometry(20, 32);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            side: THREE.DoubleSide
        });
        this.sun = new THREE.Mesh(sunGeo, sunMat);
        this.sun.position.set(0, 10, -100);
        this.group.add(this.sun);

        // 3. Buildings (Wireframe Boxes)
        const boxGeo = new THREE.BoxGeometry(5, 20, 5);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.5 });

        for (let i = 0; i < 20; i++) {
            const building = new THREE.LineSegments(edges, lineMat);
            const x = (Math.random() - 0.5) * 150;
            // Keep center clear
            if (Math.abs(x) < 20) continue;
            
            const z = (Math.random() - 0.5) * 200 - 50;
            building.position.set(x, -10 + Math.random() * 5, z);
            building.scale.y = 0.5 + Math.random() * 2;
            this.buildings.push({ mesh: building, originalY: building.scale.y });
            this.group.add(building);
        }

        this.scene.add(this.group);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.015);
    }

    update(freqData, waveData, energy, time) {
        // Move Grid to simulate speed
        this.grid.position.z += 0.5 + (energy.bass / 255);
        if (this.grid.position.z > 0) this.grid.position.z = -50;

        // Pulse Sun
        const scale = 1 + (energy.bass / 255) * 0.2;
        this.sun.scale.set(scale, scale, 1);
        
        // Sun bands effect (simple color shift)
        if (energy.isBeat) {
            this.sun.material.color.setHex(0xff00ff);
        } else {
            this.sun.material.color.lerp(new THREE.Color(0xffaa00), 0.1);
        }

        // Buildings react to frequency
        this.buildings.forEach((b, i) => {
            // Map frequency to building height
            const freqIndex = Math.floor((i / this.buildings.length) * freqData.length * 0.5);
            const val = freqData[freqIndex] / 255;
            
            b.mesh.scale.y = THREE.MathUtils.lerp(b.mesh.scale.y, b.originalY + val * 3, 0.1);
            
            // Move buildings
            b.mesh.position.z += 0.5 + (energy.bass / 255);
            if (b.mesh.position.z > 50) {
                b.mesh.position.z = -150;
                b.mesh.position.x = (Math.random() - 0.5) * 150;
                if (Math.abs(b.mesh.position.x) < 20) b.mesh.position.x += 40;
            }
        });
        
        // Camera sway could be handled in Visualizer, but we can rotate group slightly
        this.group.rotation.z = Math.sin(time * 0.5) * 0.02;
    }

    dispose() {
        this.scene.remove(this.group);
        this.scene.fog = null;
        // Dispose geometries/materials...
        this.buildings.forEach(b => {
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
        });
        this.sun.geometry.dispose();
        this.sun.material.dispose();
        this.grid.geometry.dispose();
        this.grid.material.dispose();
    }
}

