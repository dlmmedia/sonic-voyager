import * as THREE from 'three';

export class EtherealAura {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.particles = null;
    }

    init() {
        // Particle System simulating flowing aura
        const particleCount = 2000;
        const posArray = new Float32Array(particleCount * 3);
        const randomArray = new Float32Array(particleCount); // For offset

        for(let i = 0; i < particleCount; i++) {
            const r = 10 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            posArray[i*3] = r * Math.sin(phi) * Math.cos(theta);
            posArray[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
            posArray[i*3+2] = r * Math.cos(phi);
            
            randomArray[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                bass: { value: 0 },
                color1: { value: new THREE.Color(0xaaeeff) }, // Light Blue
                color2: { value: new THREE.Color(0xffaaff) }  // Pink
            },
            vertexShader: `
                uniform float time;
                uniform float bass;
                attribute float aRandom;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    vec3 pos = position;
                    
                    // Curl noise simulation (simplified)
                    float angle = time * (0.2 + aRandom * 0.5) + position.y * 0.1;
                    float radius = length(pos.xz);
                    
                    pos.x += sin(angle) * (1.0 + bass);
                    pos.y += cos(angle) * (1.0 + bass);
                    pos.z += sin(time + aRandom * 10.0) * bass;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (4.0 + bass * 5.0) * (50.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Color mixing
                    vColor = mix(vec3(0.6, 0.9, 1.0), vec3(1.0, 0.6, 0.9), sin(time + position.x * 0.1) * 0.5 + 0.5);
                    vAlpha = 0.5 + 0.5 * sin(time * 2.0 + aRandom * 10.0);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                
                void main() {
                    float d = distance(gl_PointCoord, vec2(0.5));
                    if(d > 0.5) discard;
                    
                    // Soft glow
                    float strength = 1.0 - (d * 2.0);
                    strength = pow(strength, 2.0);
                    
                    gl_FragColor = vec4(vColor, strength * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.group.add(this.particles);
        this.scene.add(this.group);
    }

    update(freqData, waveData, energy, time) {
        this.particles.material.uniforms.time.value = time;
        this.particles.material.uniforms.bass.value = energy.bass / 255;
        
        this.group.rotation.y = time * 0.1;
        this.group.rotation.z = Math.sin(time * 0.2) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}

