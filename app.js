// app.js — Fixed sizing and visibility issues
class GlassLogoApp {
  constructor(container = document.body) {
    this.container = container;
    this.mouseNDC = new THREE.Vector2(0, 0); // Initialize at center
    this._setupRenderer();
    this._setupScene();
    this._setupListeners();
    this._resize();
    this._animate();
    console.log('GlassLogoApp initialized with Three.js r' + THREE.REVISION);
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    // Backward compatibility
    if (this.renderer.outputEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    } else if (this.renderer.outputColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    
    // Set initial size
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h, false);
    
    // Append canvas to container
    this.renderer.domElement.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 100;
    `;
    this.container.appendChild(this.renderer.domElement);
  }

  _setupScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene = new THREE.Scene();

    // Camera - adjusted for better view
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 10);
    this.camera.position.z = 3; // Moved camera back

    // Environment for refraction
    this.pmremGen = new THREE.PMREMGenerator(this.renderer);
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(128, { 
      type: THREE.HalfFloatType || THREE.FloatType 
    });
    this.envCam = new THREE.CubeCamera(0.1, 10, this.cubeTarget);

    // Stronger lighting for better visibility
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(5, 5, 5);
    this.scene.add(dir1);
    
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir2.position.set(-5, -5, 5);
    this.scene.add(dir2);

    // Create star mesh
    this.star = this._createStarMesh();
    this.scene.add(this.star);
  }

  _createStarMesh() {
    // Create 8-point star shape from your SVG
    const spikes = 8;
    const outerRadius = 1;
    const innerRadius = 0.43;
    const starShape = new THREE.Shape();

    for (let i = 0; i < spikes; i++) {
      const outerAng = (i / spikes) * Math.PI * 2;
      const innerAng = outerAng + Math.PI / spikes;

      const ox = Math.cos(outerAng) * outerRadius;
      const oy = Math.sin(outerAng) * outerRadius;
      const ix = Math.cos(innerAng) * innerRadius;
      const iy = Math.sin(innerAng) * innerRadius;

      if (i === 0) starShape.moveTo(ox, oy);
      else starShape.lineTo(ox, oy);
      starShape.lineTo(ix, iy);
    }
    starShape.closePath();

    // Extrude geometry - reduced depth for subtlety
    const geo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.01,
      bevelSegments: 6
    });
    geo.center();

    // Add subtle bulge
    const posAttr = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const dist = Math.sqrt(v.x * v.x + v.y * v.y);
      v.z += (1 - dist) * 0.15; // Reduced bulge
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    // Enhanced glass material for better visibility
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05, // Slight roughness for visibility
      transmission: 0.9, // Slightly less transparent
      ior: 1.5,
      envMapIntensity: 1.5, // Stronger reflections
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.8
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(0.15); // MUCH smaller scale - was 0.33
    return mesh;
  }

  _setupListeners() {
    window.addEventListener('pointermove', (e) => {
      const rect = this.container.getBoundingClientRect();
      // Normalize mouse position to -1 to +1 range
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    
    window.addEventListener('resize', () => this._resize(), false);
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    // Gentle rotation
    this.star.rotation.x += 0.002; // Slower rotation
    this.star.rotation.y += 0.005;

    // Follow cursor - scale down movement for cursor-like behavior
    this.star.position.set(
      this.mouseNDC.x * 0.5, // Reduced movement scale
      this.mouseNDC.y * 0.5,
      0
    );

    // Update environment for refraction
    this.star.visible = false;
    this.envCam.update(this.renderer, this.scene);
    this.star.material.envMap = this.cubeTarget.texture;
    this.star.visible = true;

    this.renderer.render(this.scene, this.camera);
  }
}

// Make globally accessible
window.GlassLogoApp = GlassLogoApp;
