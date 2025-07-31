<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
    <script>
        window.addEventListener('load', function() {
            if (window.innerWidth < 1024 || typeof THREE === 'undefined') {
                document.body.style.cursor = 'auto';
                return;
            }

            class RealRefractionCursor {
                constructor() {
                    this.settings = {
                        // Refraction
                        baseRefractionStrength: 0.15,
                        maxRefractionStrength: 0.99,
                        distortionAmount: 0.24,
                        chromaticAberration: 0.22,
                        refractionIndex: 0.75,
                        // Glass
                        ambientLightIntensity: 0.99,
                        rimLightIntensity: 1.2,
                        reflectionStrength: 0.99,
                        glassThickness: 0.09,
                        fresnel: 2,
                        glassTint: [0., 0., 0],
                        // Effects
                        grainIntensity: 2.88,
                        blurAmount: 0.9,
                        // Transparency
                        glassTransparency: 0.5,
                        baseOpacity: 0.7,
                        maxOpacity: 0.95,
                        // Colors
                        ambientLightColor: [0.25, 0.25, 0.4],
                        rimLightColor: [0.5, 0.8, 1.0],
                        fillLightColor: [1.0, 0.67, 0.53],
                        blendMode: 'luminosity'
                    };

                    this.blendModes = ['Normal','difference', 'luminosity'];
                    this.currentBlendIndex = 0;
                    this.blendModeHandler = null;

                    this.container = document.querySelector('.title-canvas');
                    if (!this.container) return;

                    this.mouse = { x: 0, y: 0 };
                    this.targetMouse = { x: 0, y: 0 };
                    this.containerBounds = this.container.getBoundingClientRect();

                    try {
                        this.init();
                        this.addEventListeners();
                        this.animate();
                    } catch (error) {
                        console.error('Refraction cursor failed:', error);
                        document.body.style.cursor = 'auto';
                    }
                }

                init() {
                    this.scene = new THREE.Scene();
                    this.camera = new THREE.PerspectiveCamera(50, this.containerBounds.width / this.containerBounds.height, 0.1, 100);
                    this.camera.position.z = 10;

                    this.renderer = new THREE.WebGLRenderer({
                        alpha: true,
                        antialias: true,
                        powerPreference: 'high-performance',
                        preserveDrawingBuffer: true
                    });

                    this.renderer.setSize(this.containerBounds.width, this.containerBounds.height);
                    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                    this.renderer.setClearColor(0x000000, 0);

                    this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
                    this.renderer.domElement.style.mixBlendMode = this.settings.blendMode;

                    this.container.appendChild(this.renderer.domElement);

                    this.createRenderTargets();
                    this.createRefractionMaterial();
                    this.spheres = [];
                    this.createSpheres();
                    this.setupEnhancedLighting();
                }

                createRenderTargets() {
                    // Use full resolution for accurate sampling
                    const pixelRatio = Math.min(window.devicePixelRatio, 2);
                    this.backgroundRenderTarget = new THREE.WebGLRenderTarget(
                        this.containerBounds.width * pixelRatio, 
                        this.containerBounds.height * pixelRatio,
                        { 
                            minFilter: THREE.LinearFilter, 
                            magFilter: THREE.LinearFilter, 
                            format: THREE.RGBAFormat,
                            generateMipmaps: false
                        }
                    );

                    this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
                    this.backgroundScene = new THREE.Scene();
                    this.createBackgroundCapture();
                }

                createBackgroundCapture() {
                    // Match the exact resolution of the container for pixel-perfect sampling
                    const pixelRatio = Math.min(window.devicePixelRatio, 2);
                    this.captureCanvas = document.createElement('canvas');
                    this.captureCanvas.width = this.containerBounds.width * pixelRatio;
                    this.captureCanvas.height = this.containerBounds.height * pixelRatio;
                    this.captureContext = this.captureCanvas.getContext('2d');
                    
                    // Scale context to match pixel ratio
                    this.captureContext.scale(pixelRatio, pixelRatio);

                    this.backgroundTexture = new THREE.CanvasTexture(this.captureCanvas);
                    this.backgroundTexture.flipY = true; // Important: match WebGL coordinate system
                    this.backgroundTexture.generateMipmaps = false;
                    this.backgroundTexture.minFilter = THREE.LinearFilter;
                    this.backgroundTexture.magFilter = THREE.LinearFilter;

                    const bgGeometry = new THREE.PlaneGeometry(2, 2);
                    const bgMaterial = new THREE.MeshBasicMaterial({ 
                        map: this.backgroundTexture, 
                        side: THREE.DoubleSide 
                    });

                    this.backgroundPlane = new THREE.Mesh(bgGeometry, bgMaterial);
                    this.backgroundScene.add(this.backgroundPlane);
                    this.captureBackground();
                }

                captureBackground() {
                    try {
                        // Clear canvas
                        this.captureContext.clearRect(0, 0, this.containerBounds.width, this.containerBounds.height);
                        
                        // Get container position for accurate coordinate mapping
                        const containerRect = this.container.getBoundingClientRect();
                        
                        // Use html2canvas-like approach for better accuracy
                        const elements = document.querySelectorAll('*');
                        
                        elements.forEach((el) => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);

                            // Skip invisible elements
                            if (style.display === 'none' || 
                                style.visibility === 'hidden' || 
                                style.opacity === '0' ||
                                rect.width === 0 || 
                                rect.height === 0) return;

                            // Calculate position relative to container
                            const x = rect.left - containerRect.left;
                            const y = rect.top - containerRect.top;
                            const width = rect.width;
                            const height = rect.height;

                            // Skip elements outside container bounds
                            if (x + width < 0 || y + height < 0 || 
                                x > this.containerBounds.width || 
                                y > this.containerBounds.height) return;

                            // Draw background color
                            const bgColor = style.backgroundColor;
                            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                                this.captureContext.fillStyle = bgColor;
                                this.captureContext.fillRect(x, y, width, height);
                            }

                            // Draw background image if present
                            const bgImage = style.backgroundImage;
                            if (bgImage && bgImage !== 'none') {
                                // For gradients, create a temporary canvas
                                if (bgImage.includes('gradient')) {
                                    const tempCanvas = document.createElement('canvas');
                                    tempCanvas.width = width;
                                    tempCanvas.height = height;
                                    const tempCtx = tempCanvas.getContext('2d');
                                    
                                    // Simple gradient parsing (you could extend this)
                                    if (bgImage.includes('linear-gradient')) {
                                        const gradient = tempCtx.createLinearGradient(0, 0, width, height);
                                        gradient.addColorStop(0, '#667eea');
                                        gradient.addColorStop(1, '#764ba2');
                                        tempCtx.fillStyle = gradient;
                                        tempCtx.fillRect(0, 0, width, height);
                                        
                                        this.captureContext.drawImage(tempCanvas, x, y);
                                    }
                                }
                            }

                            // Draw text content with proper font rendering
                            if (el.textContent && el.textContent.trim() && 
                                ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'A'].includes(el.tagName)) {
                                
                                const fontSize = parseFloat(style.fontSize) || 16;
                                const fontWeight = style.fontWeight || 'normal';
                                const fontFamily = style.fontFamily || 'Area-inktrap-extended, sans-serif';
                                const color = style.color || '#000000';

                                this.captureContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                                this.captureContext.fillStyle = color;
                                this.captureContext.textAlign = 'left';
                                this.captureContext.textBaseline = 'top';

                                // Improved text wrapping
                                const text = el.textContent.trim();
                                const words = text.split(' ');
                                let line = '';
                                let lineY = y + fontSize * 0.1;
                                const lineHeight = fontSize * 1.2;

                                for (let i = 0; i < words.length; i++) {
                                    const testLine = line + (line ? ' ' : '') + words[i];
                                    const metrics = this.captureContext.measureText(testLine);

                                    if (metrics.width > width - 10 && line !== '') {
                                        this.captureContext.fillText(line, x + 5, lineY);
                                        line = words[i];
                                        lineY += lineHeight;
                                        
                                        // Stop if we exceed the element height
                                        if (lineY > y + height) break;
                                    } else {
                                        line = testLine;
                                    }

                                    // Draw the last line
                                    if (i === words.length - 1) {
                                        this.captureContext.fillText(line, x + 5, lineY);
                                    }
                                }
                            }
                        });

                    } catch (error) {
                        console.warn('Background capture error:', error);
                        // Fallback: create a simple background
                        this.captureContext.fillStyle = 'rgba(245, 245, 245, 0.8)';
                        this.captureContext.fillRect(0, 0, this.containerBounds.width, this.containerBounds.height);
                    }

                    this.backgroundTexture.needsUpdate = true;
                }

                createRefractionMaterial() {
                    const refractionVertexShader = `
                        varying vec3 vWorldPosition;
                        varying vec3 vNormal;
                        varying vec2 vUv;
                        varying vec3 vViewDirection;
                        varying vec3 vReflect;
                        varying vec4 vScreenPosition;
                        
                        void main() {
                            vUv = uv;
                            vNormal = normalize(normalMatrix * normal);
                            
                            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPosition.xyz;
                            vViewDirection = normalize(cameraPosition - vWorldPosition);
                            vReflect = reflect(-vViewDirection, vNormal);
                            
                            vec4 screenPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            vScreenPosition = screenPosition;
                            
                            gl_Position = screenPosition;
                        }
                    `;

                    const refractionFragmentShader = `
                        uniform sampler2D backgroundTexture;
                        uniform vec2 resolution;
                        uniform float time;
                        uniform float refractionStrength;
                        uniform float distortionAmount;
                        uniform float chromaticAberration;
                        uniform float refractionIndex;
                        uniform float ambientLightIntensity;
                        uniform float rimLightIntensity;
                        uniform float reflectionStrength;
                        uniform float glassThickness;
                        uniform float fresnelStrength;
                        uniform vec3 glassTint;
                        uniform float grainIntensity;
                        uniform float blurAmount;
                        uniform float baseOpacity;
                        uniform float maxOpacity;
                        uniform float glassTransparency;
                        uniform vec3 ambientLightColor;
                        uniform vec3 rimLightColor;
                        uniform vec3 fillLightColor;
                        
                        varying vec3 vWorldPosition;
                        varying vec3 vNormal;
                        varying vec2 vUv;
                        varying vec3 vViewDirection;
                        varying vec3 vReflect;
                        varying vec4 vScreenPosition;

                        float random(vec2 st) { 
                            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); 
                        }

                        void main() {
                            // Proper screen space UV calculation
                            vec2 screenUV = (vScreenPosition.xy / vScreenPosition.w) * 0.5 + 0.5;
                            
                            // Calculate refraction with proper coordinate mapping
                            vec3 refractedDir = refract(-vViewDirection, vNormal, refractionIndex);
                            vec2 refractionOffset = refractedDir.xy * refractionStrength;

                            // Add distortion based on distance from center
                            float distortion = length(vUv - 0.5) * distortionAmount;
                            refractionOffset += (vUv - 0.5) * distortion;

                            // Glass thickness effect
                            float thickness = glassThickness * (1.0 - dot(vNormal, vViewDirection));
                            refractionOffset *= (1.0 + thickness);

                            // Final UV with refraction
                            vec2 distortedUV = screenUV + refractionOffset;
                            distortedUV = clamp(distortedUV, 0.0, 1.0);

                            // Sample background with chromatic aberration
                            vec3 refractedColor = vec3(0.0);
                            
                            if (blurAmount > 0.0) {
                                // Blur sampling
                                for(int i = -2; i <= 2; i++) {
                                    for(int j = -2; j <= 2; j++) {
                                        vec2 offset = vec2(float(i), float(j)) * blurAmount / resolution;
                                        vec2 sampleUV = clamp(distortedUV + offset, 0.0, 1.0);
                                        refractedColor += texture2D(backgroundTexture, sampleUV).rgb;
                                    }
                                }
                                refractedColor /= 25.0;
                            } else {
                                // Chromatic aberration
                                vec2 aberrationR = refractionOffset * chromaticAberration;
                                vec2 aberrationB = refractionOffset * chromaticAberration * 0.8;
                                
                                float r = texture2D(backgroundTexture, clamp(distortedUV + aberrationR, 0.0, 1.0)).r;
                                float g = texture2D(backgroundTexture, distortedUV).g;
                                float b = texture2D(backgroundTexture, clamp(distortedUV - aberrationB, 0.0, 1.0)).b;
                                
                                refractedColor = vec3(r, g, b);
                            }

                            // Fresnel and lighting calculations
                            float fresnel = pow(1.0 - dot(vNormal, vViewDirection), fresnelStrength);
                            float rimLight = 1.0 - dot(vNormal, vViewDirection);
                            rimLight = pow(rimLight, 3.0) * rimLightIntensity;
                            
                            vec3 rimColor = rimLightColor * rimLight;
                            vec3 reflectionColor = mix(vec3(1.0), vec3(1.0), fresnel) * reflectionStrength;
                            vec3 ambientGlass = glassTint * ambientLightIntensity * ambientLightColor;

                            // Combine all lighting
                            vec3 finalColor = mix(refractedColor, glassTint, 0.1);
                            finalColor = mix(finalColor, reflectionColor, fresnel * reflectionStrength);
                            finalColor += rimColor;
                            finalColor += ambientGlass * 0.2 * fillLightColor;

                            // Add grain
                            if (grainIntensity > 0.0) {
                                float grain = random(gl_FragCoord.xy + time) * grainIntensity;
                                finalColor += grain * 0.1 - 0.05;
                            }

                            // Calculate final alpha
                            float alpha = glassTransparency + fresnel * 0.15;
                            alpha = mix(baseOpacity, maxOpacity, alpha);

                            gl_FragColor = vec4(finalColor, alpha);
                        }
                    `;

                    this.refractionMaterial = new THREE.ShaderMaterial({
                        vertexShader: refractionVertexShader,
                        fragmentShader: refractionFragmentShader,
                        uniforms: {
                            backgroundTexture: { value: this.backgroundTexture },
                            resolution: { value: new THREE.Vector2(this.containerBounds.width, this.containerBounds.height) },
                            time: { value: 0 },
                            refractionStrength: { value: this.settings.baseRefractionStrength },
                            distortionAmount: { value: this.settings.distortionAmount },
                            chromaticAberration: { value: this.settings.chromaticAberration },
                            refractionIndex: { value: this.settings.refractionIndex },
                            ambientLightIntensity: { value: this.settings.ambientLightIntensity },
                            rimLightIntensity: { value: this.settings.rimLightIntensity },
                            reflectionStrength: { value: this.settings.reflectionStrength },
                            glassThickness: { value: this.settings.glassThickness },
                            fresnelStrength: { value: this.settings.fresnel },
                            glassTint: { value: new THREE.Vector3(...this.settings.glassTint) },
                            grainIntensity: { value: this.settings.grainIntensity },
                            blurAmount: { value: this.settings.blurAmount },
                            baseOpacity: { value: this.settings.baseOpacity },
                            maxOpacity: { value: this.settings.maxOpacity },
                            glassTransparency: { value: this.settings.glassTransparency },
                            ambientLightColor: { value: new THREE.Vector3(...this.settings.ambientLightColor) },
                            rimLightColor: { value: new THREE.Vector3(...this.settings.rimLightColor) },
                            fillLightColor: { value: new THREE.Vector3(...this.settings.fillLightColor) }
                        },
                        transparent: true,
                        side: THREE.DoubleSide
                    });
                }

                createSpheres() {
                    const geometry = new THREE.SphereGeometry(1, 32, 64);

                    for (let i = 0; i < 5; i++) {
                        const sphere = new THREE.Mesh(geometry, this.refractionMaterial);
                        sphere.position.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2);
                        sphere.scale.setScalar((0.8 + Math.random() * 0.4) * 0.5);

                        sphere.userData = {
                            originalPosition: sphere.position.clone(),
                            phase: Math.random() * Math.PI * 2,
                            speed: 0.01 + Math.random() * 0.02,
                            baseScale: sphere.scale.x,
                            targetScale: sphere.scale.x,
                            expansionSpeed: 0.1
                        };

                        this.spheres.push(sphere);
                        this.scene.add(sphere);
                    }
                }

                setupEnhancedLighting() {
                    const ambientLight = new THREE.AmbientLight(new THREE.Color(...this.settings.ambientLightColor), this.settings.ambientLightIntensity);
                    this.scene.add(ambientLight);

                    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                    directionalLight.position.set(5, 5, 5);
                    this.scene.add(directionalLight);

                    const rimLight = new THREE.DirectionalLight(new THREE.Color(...this.settings.rimLightColor), this.settings.rimLightIntensity * 0.6);
                    rimLight.position.set(-3, 2, 4);
                    this.scene.add(rimLight);

                    const fillLight = new THREE.DirectionalLight(new THREE.Color(...this.settings.fillLightColor), 0.3);
                    fillLight.position.set(2, -3, 2);
                    this.scene.add(fillLight);
                }

                setupBlendModeForElement(element) {
                    const cursorInstance = this;
                    if (this.blendModeHandler) element.removeEventListener('mouseenter', this.blendModeHandler);

                    this.blendModeHandler = function() {
                        cursorInstance.currentBlendIndex = (cursorInstance.currentBlendIndex + 1) % cursorInstance.blendModes.length;
                        const newBlendMode = cursorInstance.blendModes[cursorInstance.currentBlendIndex];
                        cursorInstance.renderer.domElement.style.mixBlendMode = newBlendMode;
                        console.log(`Blend: ${newBlendMode}`);
                    };

                    element.addEventListener('mouseenter', this.blendModeHandler);
                }

                setupBlendModeListeners() {
                    const cursorInstance = this;
                    const findAndSetupElements = () => {
                        const selectors = ['.Change-switch', '.change-switch', '[class*="change-switch"]', '[class*="Change-switch"]'];
                        let changeSwitchElements = [];

                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                changeSwitchElements = elements;
                                break;
                            }
                        }

                        if (changeSwitchElements.length > 0) {
                            changeSwitchElements.forEach(element => cursorInstance.setupBlendModeForElement(element));
                            return true;
                        }
                        return false;
                    };

                    if (findAndSetupElements()) return;
                    setTimeout(() => { if (findAndSetupElements()) return; }, 1000);
                    setTimeout(() => { if (findAndSetupElements()) return; }, 3000);
                    setTimeout(() => findAndSetupElements(), 5000);
                }

                addEventListeners() {
                    window.addEventListener('mousemove', (e) => {
                        const rect = this.container.getBoundingClientRect();
                        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            this.targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                            this.targetMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                        }
                    });

                    this.setupBlendModeListeners();

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => this.setupBlendModeListeners());
                    } else if (document.readyState === 'interactive') {
                        setTimeout(() => this.setupBlendModeListeners(), 1000);
                    }

                    const observer = new MutationObserver((mutations) => {
                        let foundNewElements = false;
                        mutations.forEach((mutation) => {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === 1) {
                                    if (node.classList && (node.classList.contains('Change-switch') || node.classList.contains('change-switch'))) {
                                        this.setupBlendModeForElement(node);
                                        foundNewElements = true;
                                    }
                                    const childElements = node.querySelectorAll && node.querySelectorAll('.Change-switch, .change-switch');
                                    if (childElements && childElements.length > 0) {
                                        childElements.forEach(child => this.setupBlendModeForElement(child));
                                        foundNewElements = true;
                                    }
                                }
                            });
                        });
                        if (foundNewElements) console.log('New elements setup');
                    });

                    observer.observe(document.body, { childList: true, subtree: true });

                    window.addEventListener('resize', () => {
                        if (window.innerWidth < 1024) {
                            document.body.style.cursor = 'auto';
                            return;
                        }

                        this.containerBounds = this.container.getBoundingClientRect();
                        this.camera.aspect = this.containerBounds.width / this.containerBounds.height;
                        this.camera.updateProjectionMatrix();
                        this.renderer.setSize(this.containerBounds.width, this.containerBounds.height);

                        // Update resolution uniforms
                        this.refractionMaterial.uniforms.resolution.value.set(this.containerBounds.width, this.containerBounds.height);

                        // Recreate capture canvas with new dimensions
                        const pixelRatio = Math.min(window.devicePixelRatio, 2);
                        this.captureCanvas.width = this.containerBounds.width * pixelRatio;
                        this.captureCanvas.height = this.containerBounds.height * pixelRatio;
                        this.captureContext.scale(pixelRatio, pixelRatio);
                        
                        // Update background render target
                        this.backgroundRenderTarget.setSize(
                            this.containerBounds.width * pixelRatio, 
                            this.containerBounds.height * pixelRatio
                        );
                    });

                    // Capture background more frequently for dynamic content
                    setInterval(() => this.captureBackground(), 50);
                }

                animate() {
                    requestAnimationFrame(() => this.animate());

                    const time = Date.now() * 0.001;
                    this.refractionMaterial.uniforms.time.value = time;

                    // Smooth mouse interpolation
                    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.08;
                    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.08;

                    this.spheres.forEach((sphere, index) => {
                        const userData = sphere.userData;
                        const mousePos = new THREE.Vector3(this.mouse.x * 5, this.mouse.y * 5, 0);
                        const distance = sphere.position.distanceTo(mousePos);
                        const influence = Math.max(0, 1 - distance / 4);

                        if (influence > 0) {
                            const direction = mousePos.clone().sub(sphere.position);
                            direction.multiplyScalar(influence * 0.04);
                            sphere.position.add(direction);

                            const dynamicRefraction = this.settings.baseRefractionStrength + influence * (this.settings.maxRefractionStrength - this.settings.baseRefractionStrength);
                            this.refractionMaterial.uniforms.refractionStrength.value = dynamicRefraction;
                            userData.targetScale = userData.baseScale * (1 + influence * 0.8);
                        } else {
                            userData.targetScale = userData.baseScale;
                        }

                        // Sphere interaction
                        this.spheres.forEach((otherSphere, otherIndex) => {
                            if (index !== otherIndex) {
                                const dist = sphere.position.distanceTo(otherSphere.position);
                                const minDistance = (sphere.scale.x + otherSphere.scale.x) * 1.4;
                                if (dist < minDistance) {
                                    userData.targetScale = Math.max(userData.targetScale, userData.baseScale * 1.5);
                                    otherSphere.userData.targetScale = Math.max(otherSphere.userData.targetScale, otherSphere.userData.baseScale * 1.5);
                                }
                            }
                        });

                        // Smooth scaling
                        const currentScale = sphere.scale.x;
                        const scaleDiff = userData.targetScale - currentScale;
                        const newScale = currentScale + scaleDiff * userData.expansionSpeed;
                        sphere.scale.setScalar(newScale);

                        // Floating animation
                        sphere.position.y += Math.sin(time + userData.phase) * 0.008;
                        sphere.position.x += Math.cos(time + userData.phase * 0.7) * 0.006;

                        // Return to original position when mouse is away
                        if (influence < 0.3) {
                            sphere.position.lerp(userData.originalPosition, 0.02);
                            this.refractionMaterial.uniforms.refractionStrength.value = this.settings.baseRefractionStrength;
                        }

                        // Rotation
                        sphere.rotation.x += userData.speed;
                        sphere.rotation.y += userData.speed * 0.8;
                    });

                    this.renderer.render(this.scene, this.camera);
                }
            }

            new RealRefractionCursor();
        });
    </script>
