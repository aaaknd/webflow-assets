class GlassLogoApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.glassLogo = null;
        this.mouse = { x: 0, y: 0 };
        this.targetMouse = { x: 0, y: 0 };
        this.backgroundTexture = null;
        this.animationId = null;
        
        this.init();
    }

    async init() {
        try {
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLights();
            await this.createBackgroundTexture();
            this.createGlassLogo();
            this.setupEventListeners();
            this.animate();
            this.hideLoading();
        } catch (error) {
            console.error('Error initializing 3D scene:', error);
            this.hideLoading();
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent background
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
    }

    setupRenderer() {
        const canvas = document.getElementById('glass-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            premultipliedAlpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Additional rim lighting
        const rimLight = new THREE.DirectionalLight(0x32b8c6, 0.5);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);

        // Environment for reflections
        const envGeometry = new THREE.SphereGeometry(50, 32, 32);
        const envMaterial = new THREE.MeshBasicMaterial({
            color: 0x134252,
            side: THREE.BackSide
        });
        const envSphere = new THREE.Mesh(envGeometry, envMaterial);
        this.scene.add(envSphere);
    }

    async createBackgroundTexture() {
        return new Promise((resolve) => {
            // Create a canvas to render the background text
            const textCanvas = document.createElement('canvas');
            const ctx = textCanvas.getContext('2d');
            
            // Set canvas size
            const scale = 2; // For higher resolution
            textCanvas.width = window.innerWidth * scale;
            textCanvas.height = window.innerHeight * scale;
            
            // Scale context for high DPI
            ctx.scale(scale, scale);
            
            // Fill background
            const gradient = ctx.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
            gradient.addColorStop(0, '#13343B');
            gradient.addColorStop(0.5, '#262828');
            gradient.addColorStop(1, '#13343B');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            
            // Set text properties
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Title
            ctx.font = 'bold 64px FKGroteskNeue, Arial, sans-serif';
            const titleGradient = ctx.createLinearGradient(0, 0, window.innerWidth, 0);
            titleGradient.addColorStop(0, '#32B8C6');
            titleGradient.addColorStop(1, '#F5F5F5');
            ctx.fillStyle = titleGradient;
            ctx.fillText("Aabhinav's Product & Visual Design Portfolio", window.innerWidth / 2, window.innerHeight * 0.3);
            
            // Bio text
            ctx.font = '24px FKGroteskNeue, Arial, sans-serif';
            ctx.fillStyle = '#A7A9A9';
            const bioText = "Here is what you need to know about me — I am a designer mildly obsessed with making the complicated feel effortless";
            const bioText2 = "(and occasionally pretending it was easy all along). With over 5 years of experience in product design—";
            const bioText3 = "and even more in visual—I now craft ideas into clarity from 📍Dehradun ⛅︎, with coffee in one hand and Ctrl+Z always within reach.";
            
            ctx.fillText(bioText, window.innerWidth / 2, window.innerHeight * 0.45);
            ctx.fillText(bioText2, window.innerWidth / 2, window.innerHeight * 0.5);
            ctx.fillText(bioText3, window.innerWidth / 2, window.innerHeight * 0.55);
            
            // Additional content
            ctx.font = 'bold 32px FKGroteskNeue, Arial, sans-serif';
            ctx.fillStyle = '#32B8C6';
            ctx.fillText("Product Design", window.innerWidth * 0.25, window.innerHeight * 0.7);
            ctx.fillText("Visual Design", window.innerWidth * 0.75, window.innerHeight * 0.7);
            
            ctx.font = '20px FKGroteskNeue, Arial, sans-serif';
            ctx.fillStyle = '#777C7C';
            ctx.fillText("Crafting user experiences that bridge", window.innerWidth * 0.25, window.innerHeight * 0.75);
            ctx.fillText("the gap between complex functionality", window.innerWidth * 0.25, window.innerHeight * 0.78);
            ctx.fillText("and intuitive interaction.", window.innerWidth * 0.25, window.innerHeight * 0.81);
            
            ctx.fillText("Creating visual narratives that speak", window.innerWidth * 0.75, window.innerHeight * 0.75);
            ctx.fillText("before words do. From brand identity", window.innerWidth * 0.75, window.innerHeight * 0.78);
            ctx.fillText("to digital interfaces.", window.innerWidth * 0.75, window.innerHeight * 0.81);
            
            // Create texture from canvas
            this.backgroundTexture = new THREE.CanvasTexture(textCanvas);
            this.backgroundTexture.flipY = false;
            this.backgroundTexture.wrapS = THREE.ClampToEdgeWrapping;
            this.backgroundTexture.wrapT = THREE.ClampToEdgeWrapping;
            
            resolve();
        });
    }

    createGlassLogo() {
        // Parse SVG path and create star shape
        const starShape = this.createStarShape();
        
        // Create extruded geometry
        const extrudeSettings = {
            depth: 0.3,
            bevelEnabled: true,
            bevelSegments: 8,
            steps: 2,
            bevelSize: 0.02,
            bevelThickness: 0.02
        };

        const geometry = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
        
        // Center the geometry
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        
        // Scale to appropriate size
        const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
        const scale = 2 / size;
        geometry.scale(scale, -scale, scale); // Flip Y to match SVG coordinate system

        // Create glass material
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.05,
            transmission: 0.98,
            transparent: true,
            opacity: 0.3,
            ior: 1.5,
            thickness: 0.5,
            envMapIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });

        // Add background texture as environment map for refraction
        if (this.backgroundTexture) {
            glassMaterial.envMap = this.backgroundTexture;
        }

        // Create mesh
        this.glassLogo = new THREE.Mesh(geometry, glassMaterial);
        this.glassLogo.castShadow = true;
        this.glassLogo.receiveShadow = true;
        
        this.scene.add(this.glassLogo);
    }

    createStarShape() {
        const shape = new THREE.Shape();
        
        // Simplified star shape based on the SVG path
        // This creates a 6-pointed star with an inner shape
        const outerRadius = 1;
        const innerRadius = 0.4;
        const points = 6;
        
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i / (points * 2)) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }
        
        shape.closePath();
        
        // Add inner eye-like shape (hole)
        const eyeShape = new THREE.Path();
        const eyePoints = [
            { x: -0.2, y: 0.1 },
            { x: 0.2, y: 0.1 },
            { x: 0.15, y: -0.1 },
            { x: -0.15, y: -0.1 }
        ];
        
        eyeShape.moveTo(eyePoints[0].x, eyePoints[0].y);
        for (let i = 1; i < eyePoints.length; i++) {
            eyeShape.lineTo(eyePoints[i].x, eyePoints[i].y);
        }
        eyeShape.closePath();
        
        shape.holes.push(eyeShape);
        
        return shape;
    }

    setupEventListeners() {
        // Mouse movement
        window.addEventListener('mousemove', (event) => {
            this.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.createBackgroundTexture(); // Recreate texture for new size
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Smooth mouse following
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

        if (this.glassLogo) {
            // Update position based on mouse
            this.glassLogo.position.x = this.mouse.x * 2;
            this.glassLogo.position.y = this.mouse.y * 2;
            
            // Gentle continuous rotation
            this.glassLogo.rotation.y += 0.005;
            this.glassLogo.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
            
            // Subtle scale animation
            const scale = 1 + Math.sin(Date.now() * 0.002) * 0.05;
            this.glassLogo.scale.setScalar(scale);
        }

        this.renderer.render(this.scene, this.camera);
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.backgroundTexture) {
            this.backgroundTexture.dispose();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if THREE.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('THREE.js failed to load');
        document.getElementById('loading').innerHTML = '<p>Error loading 3D graphics</p>';
        return;
    }
    
    // Initialize the glass logo app
    window.glassApp = new GlassLogoApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.glassApp) {
        window.glassApp.dispose();
    }
});