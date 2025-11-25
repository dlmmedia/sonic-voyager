import * as THREE from 'three';

export class ChromeCadenceVisual {
    constructor(scene) {
        this.scene = scene;
        this.meshes = [];
        this.isInit = false;
        this.textureLoader = new THREE.TextureLoader();
        this.artworkTexture = null;
        this.billboardMaterial = null;
    }

    init() {
        if (this.isInit) return;

        // 1. Endless Highway Floor
        const planeGeo = new THREE.PlaneGeometry(200, 1000, 100, 100);
        // Displacement for terrain feel
        const pos = planeGeo.attributes.position;
        for(let i = 0; i < pos.count; i++){
             // Flatten the center for the road
             const x = pos.getX(i);
             if(Math.abs(x) > 20) {
                pos.setZ(i, Math.random() * 5);
             } else {
                pos.setZ(i, 0);
             }
        }
        planeGeo.computeVertexNormals();

        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2,
            wireframe: true
        });
        this.floor = new THREE.Mesh(planeGeo, planeMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -10;
        this.scene.add(this.floor);
        this.meshes.push(this.floor);

        // 2. Road Lines (Instanced)
        const lineGeo = new THREE.BoxGeometry(2, 0.5, 10);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        this.roadLines = new THREE.InstancedMesh(lineGeo, lineMat, 20);
        
        const dummy = new THREE.Object3D();
        for(let i=0; i<20; i++) {
            dummy.position.set(0, -9.8, -i * 50 + 50);
            dummy.updateMatrix();
            this.roadLines.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.roadLines);
        this.meshes.push(this.roadLines);

        // 3. Side Pillars/Lights (Instanced)
        const pillarGeo = new THREE.CylinderGeometry(1, 1, 10, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ 
            color: 0x00F0FF, 
            emissive: 0x00F0FF,
            emissiveIntensity: 0.5 
        });
        this.pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, 40);
        
        for(let i=0; i<20; i++) {
            // Left
            dummy.position.set(-30, -5, -i * 40 + 100);
            dummy.updateMatrix();
            this.pillars.setMatrixAt(i * 2, dummy.matrix);
            
            // Right
            dummy.position.set(30, -5, -i * 40 + 100);
            dummy.updateMatrix();
            this.pillars.setMatrixAt(i * 2 + 1, dummy.matrix);
        }
        this.scene.add(this.pillars);
        this.meshes.push(this.pillars);

        // 4. Artwork Billboard
        const boardGeo = new THREE.PlaneGeometry(50, 50);
        this.billboardMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        this.billboard = new THREE.Mesh(boardGeo, this.billboardMaterial);
        this.billboard.position.set(0, 20, -60); // Closer
        this.scene.add(this.billboard);
        this.meshes.push(this.billboard);

        // Add a frame to the billboard
        const frameGeo = new THREE.BoxGeometry(52, 52, 1);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1.0, roughness: 0.1 });
        this.frame = new THREE.Mesh(frameGeo, frameMat);
        this.frame.position.copy(this.billboard.position);
        this.frame.position.z -= 0.6;
        this.scene.add(this.frame);
        this.meshes.push(this.frame);

        // Lights
        this.ambientLight = new THREE.AmbientLight(0x222222);
        this.scene.add(this.ambientLight);
        
        this.spotLight = new THREE.SpotLight(0xffffff, 1);
        this.spotLight.position.set(0, 50, 0);
        this.spotLight.angle = Math.PI / 6;
        this.spotLight.penumbra = 0.5;
        this.scene.add(this.spotLight);

        // 5. Speed Particles
        const particlesGeo = new THREE.BufferGeometry();
        const particleCount = 1000;
        const posArray = new Float32Array(particleCount * 3);
        
        for(let i = 0; i < particleCount * 3; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 200; // x
            posArray[i+1] = (Math.random() - 0.5) * 100; // y
            posArray[i+2] = Math.random() * 200 - 100; // z
        }
        
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({
            size: 0.2,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.particles = new THREE.Points(particlesGeo, particleMat);
        this.scene.add(this.particles);
        this.meshes.push(this.particles);

        this.isInit = true;
    }

    update(data, waveData, features, time) {
        if (!this.isInit) return;

        const speed = 50 * (1 + features.bass / 255); // Speed up with bass

        // Animate Particles
        const positions = this.particles.geometry.attributes.position.array;
        for(let i = 2; i < positions.length; i += 3) {
            positions[i] += speed * 0.5 * 0.1; // move towards camera (positive Z?)
            // Actually, if camera is at 30, and looking at 0,0,0.
            // If we want them to fly past, they should move +Z or -Z depending on direction.
            // Road moves +Z (towards camera effectively if we look down -Z? No, standard camera looks down -Z).
            // Wait, standard THREE camera at Z=30 looking at 0,0,0 means looking down -Z.
            // Objects at -100 are far away.
            // If objects move +Z, they come closer.
            
            if (positions[i] > 50) {
                positions[i] = -150;
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;

        // Animate Road Lines
        const dummy = new THREE.Object3D();
        for(let i=0; i<20; i++) {
            let z = (-i * 50 + 50 + time * speed) % 1000;
            if (z > 50) z -= 1000;
            dummy.position.set(0, -9.8, z);
            dummy.updateMatrix();
            this.roadLines.setMatrixAt(i, dummy.matrix);
        }
        this.roadLines.instanceMatrix.needsUpdate = true;

        // Animate Pillars
        const color = new THREE.Color();
        color.setHSL((time * 0.1) % 1, 1, 0.5);
        
        for(let i=0; i<20; i++) {
            // Left
            let z = (-i * 40 + 100 + time * speed) % 800;
            if (z > 100) z -= 800;
            
            // Scale on beat
            let scaleY = 1 + (features.bass / 255) * 2 * (Math.sin(i + time) * 0.5 + 0.5);
            
            dummy.scale.set(1, scaleY, 1);
            dummy.position.set(-30, -5 + (scaleY * 5), z); // Adjust Y to keep base on ground
            dummy.updateMatrix();
            this.pillars.setMatrixAt(i * 2, dummy.matrix);
            this.pillars.setColorAt(i * 2, color);

            // Right
            dummy.position.set(30, -5 + (scaleY * 5), z);
            dummy.updateMatrix();
            this.pillars.setMatrixAt(i * 2 + 1, dummy.matrix);
            this.pillars.setColorAt(i * 2 + 1, color);
        }
        this.pillars.instanceMatrix.needsUpdate = true;
        this.pillars.instanceColor.needsUpdate = true;

        // Floor Wiggle
        this.floor.material.wireframeLinewidth = 1 + (features.treble / 255) * 3;
        this.floor.position.z = (time * speed * 0.5) % 20; // subtle texture slide if using texture, here just mesh moves

        // Billboard Logic
        // Float up and down
        this.billboard.position.y = 15 + Math.sin(time * 0.5) * 2;
        this.frame.position.y = this.billboard.position.y;

        // Rotate slightly
        this.billboard.rotation.y = Math.sin(time * 0.3) * 0.1;
        this.frame.rotation.y = this.billboard.rotation.y;

        // If beat, maybe flash the frame
        if (features.isBeat) {
            this.frame.material.emissive.setHex(0x444444);
        } else {
            this.frame.material.emissive.setHex(0x000000);
        }
    }

    setArtwork(url) {
        if (!url) return;
        this.textureLoader.load(url, (texture) => {
            this.artworkTexture = texture;
            if (this.billboardMaterial) {
                this.billboardMaterial.map = this.artworkTexture;
                this.billboardMaterial.needsUpdate = true;
            }
        });
    }

    dispose() {
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        this.scene.remove(this.ambientLight);
        this.scene.remove(this.spotLight);
        this.meshes = [];
        this.isInit = false;
    }
}

