// app.js — safe for Three.js r128+
class GlassLogoApp {
  constructor(container = document.body) {
    this.container = container;
    this.mouseNDC = new THREE.Vector2();
    this._setupRenderer();
    this._setupScene();
    this._setupListeners();
    this._resize();
    this._animate();
    // Debug: Log Three.js version
    console.log('Three.js version:', THREE.REVISION || 'Unknown');
  }
  _setupRenderer() {
    const existingCanvas = document.querySelector('#glass-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas      : existingCanvas || undefined,
      alpha       : true, antialias: true, powerPreference: 'high-performance'
    });
    // Backward compatibility for outputEncoding
    if (this.renderer.outputEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    } else if (this.renderer.outputColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  _setupScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene  = new THREE.Scene();
    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 10);
    this.camera.position.z = 2;
    // Environment
    this.pmremGen   = new THREE.PMREMGenerator(this.renderer);
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType || THREE.FloatType });
    this.envCam     = new THREE.CubeCamera(0.1, 10, this.cubeTarget);
    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5,5,5);
    this.scene.add(dir);
    // Glass star mesh
    this.star = this._createStarMesh();
    this.scene.add(this.star);
  }
  _createStarMesh() {
    // Eight-point star, bulged, from SVG
    const spikes = 8, outerRadius = 1, innerRadius = 0.43;
    const starShape = new THREE.Shape();
    for (let i = 0; i < spikes; i++) {
      const outerAng = (i / spikes) * Math.PI * 2;
      const innerAng = outerAng + Math.PI / spikes;
      const ox = Math.cos(outerAng) * outerRadius, oy = Math.sin(outerAng) * outerRadius;
      const ix = Math.cos(innerAng) * innerRadius, iy = Math.sin(innerAng) * innerRadius;
      i === 0 ? starShape.moveTo(ox, oy) : starShape.lineTo(ox, oy);
      starShape.lineTo(ix, iy);
    }
    starShape.closePath();

    const geo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.02, bevelSegments: 8
    });
    geo.center();
    // Bulge
    const posAttr = geo.attributes.position, v = new THREE.Vector3();
    for (let i=0; i<posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const dist = Math.sqrt(v.x*v.x + v.y*v.y);
      v.z += (1-dist)*0.25;
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    // Glass material: only use props supported by r128+!
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 1.45,
      envMapIntensity: 1.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05
      // thickness: 0.4, // COMMENTED OUT for r128 compatibility!
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(0.33);
    return mesh;
  }
  _setupListeners() {
    window.addEventListener('pointermove', (e) => {
      const rect = this.container.getBoundingClientRect();
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    window.addEventListener('resize', () => this._resize(), false);
  }
  _resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
  }
  _animate() {
    requestAnimationFrame(() => this._animate());
    // gentle spin
    this.star.rotation.x += 0.005;
    this.star.rotation.y += 0.01;
    // follow cursor
    this.star.position.set(this.mouseNDC.x, this.mouseNDC.y, 0);
    // environment for refraction
    this.star.visible = false;
    this.envCam.update(this.renderer, this.scene);
    this.star.material.envMap = this.cubeTarget.texture;
    this.star.visible = true;
    this.renderer.render(this.scene, this.camera);
  }
}
window.GlassLogoApp = GlassLogoApp;
</details>
