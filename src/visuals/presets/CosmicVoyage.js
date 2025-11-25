import * as THREE from 'three';

export class CosmicVoyage {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.stars = null;
        this.nebula = [];
    }

    init() {
        // 1. Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = 3000;
        const posArray = new Float32Array(starCount * 3);
        const sizeArray = new Float32Array(starCount);

        for(let i = 0; i < starCount; i++) {
            posArray[i*3] = (Math.random() - 0.5) * 100;
            posArray[i*3+1] = (Math.random() - 0.5) * 100;
            posArray[i*3+2] = (Math.random() - 0.5) * 100;
            sizeArray[i] = Math.random();
        }
        
        starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starGeo.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

        // Simple shader for stars to twinkle
        const starMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0xffffff) }
            },
            vertexShader: `
                attribute float size;
                varying float vAlpha;
                uniform float time;
                void main() {
                    vAlpha = 0.5 + 0.5 * sin(time * 5.0 + position.x);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                varying float vAlpha;
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5));
                    if (r > 0.5) discard;
                    gl_FragColor = vec4(color, vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.stars = new THREE.Points(starGeo, starMat);
        this.group.add(this.stars);

        // 2. Procedural Nebula Clouds (Billboards)
        const texture = this.createNoiseTexture();
        const cloudMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending,
            color: 0x8800ff,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        for (let i=0; i<10; i++) {
            const cloudGeo = new THREE.PlaneGeometry(20, 20);
            const cloud = new THREE.Mesh(cloudGeo, cloudMat);
            cloud.position.set(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
            );
            cloud.rotation.z = Math.random() * Math.PI;
            cloud.lookAt(0,0,0); // Face center roughly
            this.nebula.push(cloud);
            this.group.add(cloud);
        }

        this.scene.add(this.group);
    }

    createNoiseTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient for soft blob
        const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,size,size);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    update(freqData, waveData, energy, time) {
        // Fly through effect
        const speed = 0.1 + (energy.bass / 255) * 0.5;
        
        // Update stars uniform
        if (this.stars) {
            this.stars.material.uniforms.time.value = time;
            // Move stars towards camera
            const positions = this.stars.geometry.attributes.position.array;
            for(let i=0; i < positions.length; i+=3) {
                positions[i+2] += speed;
                if (positions[i+2] > 30) {
                    positions[i+2] = -70; // Reset to far back
                }
            }
            this.stars.geometry.attributes.position.needsUpdate = true;
        }

        // Update Nebula colors and rotation
        this.nebula.forEach((cloud, i) => {
            cloud.rotation.z += 0.002 * (i%2===0 ? 1 : -1);
            
            // Pulse opacity
            cloud.material.opacity = 0.1 + (energy.mid / 255) * 0.2;
            
            // Color shift on beat
            if (energy.isBeat) {
                cloud.material.color.setHSL(0.6 + Math.random()*0.2, 1, 0.6); // Blue/Purple range
            } else {
                cloud.material.color.lerp(new THREE.Color(0x4400ff), 0.05);
            }
        });
        
        // Rotate whole group slowly
        this.group.rotation.z = Math.sin(time * 0.2) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        if (this.stars) {
            this.stars.geometry.dispose();
            this.stars.material.dispose();
        }
        this.nebula.forEach(c => {
            c.geometry.dispose();
            c.material.dispose();
        });
        this.nebula = [];
    }
}
