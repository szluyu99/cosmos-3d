/* ============================================================
   COSMOS 3D — 渲染核心：相机、控制器、泛光、标签、拾取
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------------- 相机控制器 ---------------- */
  class Rig {
    constructor(camera, dom) {
      this.camera = camera;
      this.dom = dom;
      this.target = new THREE.Vector3();
      this.radius = 120;
      this.theta = 0.6;
      this.phi = 1.15;
      this.tTarget = this.target.clone();
      this.tRadius = this.radius;
      this.tTheta = this.theta;
      this.tPhi = this.phi;
      this.minRadius = 0.5;
      this.maxRadius = 500;
      this.minPhi = 0.06;
      this.maxPhi = Math.PI - 0.06;
      this.dragging = false;
      this.moved = 0;
      this.px = 0; this.py = 0;
      this.fly = null;
      this.follow = null;
      this.enabled = true;
      this.zoomEnabled = true;
      this._bind();
    }

    _bind() {
      const el = this.dom;
      el.addEventListener('pointerdown', e => {
        if (!this.enabled) return;
        this.dragging = true;
        this.moved = 0;
        this.px = e.clientX; this.py = e.clientY;
        this.fly = null;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', e => {
        if (!this.dragging) return;
        const dx = e.clientX - this.px, dy = e.clientY - this.py;
        this.px = e.clientX; this.py = e.clientY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.tTheta -= dx * 0.005;
        this.tPhi = clamp(this.tPhi - dy * 0.004, this.minPhi, this.maxPhi);
      });
      const up = e => {
        if (!this.dragging) return;
        this.dragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch (err) { }
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => {
        if (!this.enabled || !this.zoomEnabled) return;
        e.preventDefault();
        const k = Math.exp(clamp(e.deltaY, -120, 120) * 0.0016);
        this.tRadius = clamp(this.tRadius * k, this.minRadius, this.maxRadius);
        this.fly = null;
      }, { passive: false });

      // 触摸缩放
      let pinch = 0;
      el.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
          pinch = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });
      el.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && pinch && this.zoomEnabled) {
          const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this.tRadius = clamp(this.tRadius * (pinch / d), this.minRadius, this.maxRadius);
          pinch = d;
          this.fly = null;
        }
      }, { passive: true });
      el.addEventListener('touchend', () => { pinch = 0; }, { passive: true });
    }

    setLimits(min, max) {
      this.minRadius = min;
      this.maxRadius = max;
    }

    snap(target, radius, theta, phi) {
      this.target.copy(target);
      this.tTarget.copy(target);
      this.radius = this.tRadius = radius;
      if (theta !== undefined) this.theta = this.tTheta = theta;
      if (phi !== undefined) this.phi = this.tPhi = phi;
      this.fly = null;
      this.follow = null;
    }

    flyTo(target, radius, opts) {
      opts = opts || {};
      this.fly = {
        t: 0, dur: opts.duration || 1.5,
        fromT: this.target.clone(), toT: target.clone(),
        fromR: this.radius, toR: radius,
        fromTheta: this.theta, toTheta: opts.theta !== undefined ? opts.theta : this.theta,
        fromPhi: this.phi, toPhi: opts.phi !== undefined ? opts.phi : this.phi
      };
      this.tTarget.copy(target);
      this.tRadius = radius;
    }

    update(dt) {
      if (this.fly) {
        const f = this.fly;
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = easeInOut(f.t);
        this.target.lerpVectors(f.fromT, f.toT, e);
        this.radius = f.fromR + (f.toR - f.fromR) * e;
        this.theta = f.fromTheta + (f.toTheta - f.fromTheta) * e;
        this.phi = f.fromPhi + (f.toPhi - f.fromPhi) * e;
        this.tRadius = this.radius;
        this.tTheta = this.theta;
        this.tPhi = this.phi;
        this.tTarget.copy(this.target);
        if (f.t >= 1) this.fly = null;
      } else {
        if (this.follow) {
          const p = this.follow();
          if (p) {
            this.tTarget.copy(p);
            if (!this.dragging) this.target.lerp(p, 1 - Math.exp(-dt * 7));
          }
        }
        const k = 1 - Math.exp(-dt * 9);
        this.radius += (this.tRadius - this.radius) * k;
        this.theta += (this.tTheta - this.theta) * k;
        this.phi += (this.tPhi - this.phi) * k;
        if (!this.follow) this.target.lerp(this.tTarget, k);
      }

      const r = this.radius;
      const sp = Math.sin(this.phi);
      this.camera.position.set(
        this.target.x + r * sp * Math.sin(this.theta),
        this.target.y + r * Math.cos(this.phi),
        this.target.z + r * sp * Math.cos(this.theta)
      );
      this.camera.lookAt(this.target);
    }
  }

  /* ---------------- 泛光着色器 ---------------- */
  const VERT = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const BRIGHT = `
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    uniform float uSoft;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(uThreshold, uThreshold + uSoft, l);
      gl_FragColor = vec4(c * k, 1.0);
    }
  `;

  const BLUR = `
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    varying vec2 vUv;
    void main(){
      vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      s += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
      s += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
      s += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
      s += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(s, 1.0);
    }
  `;

  const COMPOSITE = `
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform float uBloom;
    uniform float uExposure;
    uniform float uVignette;
    uniform float uAspect;
    uniform vec4 uLens;      // xy: 屏幕 uv, z: 视界半径(uv), w: 强度
    uniform float uTime;
    varying vec2 vUv;

    vec3 aces(vec3 x){
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c){
      return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92,
                 step(c, vec3(0.0031308)));
    }

    void main(){
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
      vec2 bh = (uLens.xy - 0.5) * vec2(uAspect, 1.0);
      float rs = uLens.z * uAspect;
      if (uLens.w > 0.001) {
        vec2 d = p - bh;
        float r = max(length(d), 1e-4);
        float pull = (rs * rs) / max(r, rs * 1.05) * uLens.w;
        float r2 = max(r - pull, rs * 0.82);
        vec2 uv2 = bh + (d / r) * r2;
        uv2 = uv2 / vec2(uAspect, 1.0) + 0.5;
        float mask = smoothstep(rs * 0.98, rs * 1.35, r);
        uv = mix(uv2, uv, mask);
      }

      vec3 col = texture2D(tScene, uv).rgb;
      vec3 bloom = texture2D(tBloom, uv).rgb;
      col += bloom * uBloom;
      col *= uExposure;
      col = aces(col);

      // 暗角
      float v = smoothstep(0.95, 0.28, length((vUv - 0.5) * vec2(1.0, 0.95)));
      col *= mix(1.0, v, uVignette);

      // 极轻微抖动，避免色带
      float dither = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
      col += dither;

      gl_FragColor = vec4(toSRGB(col), 1.0);
    }
  `;

  /* ---------------- 主对象 ---------------- */
  const Core = {
    canvas: null, renderer: null, camera: null, rig: null,
    width: 1, height: 1, dpr: 1,
    scenes: {}, activeName: null, active: null,
    clock: new THREE.Clock(),
    elapsed: 0,
    bloomStrength: 0.85,
    bloomEnabled: true,
    exposure: 1.0,
    lens: new THREE.Vector4(0.5, 0.5, 0.1, 0),
    labels: [],
    labelLayer: null,
    pickables: [],
    raycaster: new THREE.Raycaster(),
    timeScale: 1,
    paused: false,
    onPick: null,
    onObjectChange: null,
    quality: 1,

    init(canvas, labelLayer) {
      this.canvas = canvas;
      this.labelLayer = labelLayer;

      this.renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
        stencil: false
      });
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.setClearColor(0x02040a, 1);

      this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
      this.rig = new Rig(this.camera, canvas);
      this.rig.snap(new THREE.Vector3(), 120, 0.6, 1.1);

      this._buildBloom();
      this._bindEvents();
      this.resize();
      this.loop();
    },

    /* ---------- 泛光管线 ---------- */
    _buildBloom() {
      const rtOpt = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
      this.sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpt);
      this.brightRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
      this.blurRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });

      this.quadScene = new THREE.Scene();
      this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geo = new THREE.PlaneGeometry(2, 2);

      this.brightMat = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.55 }, uSoft: { value: 0.45 } },
        vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false
      });
      this.blurMat = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
        vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false
      });
      this.compMat = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: null }, tBloom: { value: null },
          uBloom: { value: 0.9 }, uExposure: { value: 1 }, uVignette: { value: 0.55 },
          uAspect: { value: 1 }, uLens: { value: this.lens }, uTime: { value: 0 }
        },
        vertexShader: VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false
      });

      this._pass = (mat, target) => {
        this.quadScene.children.length = 0;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        this.quadScene.add(mesh);
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
        this.renderer.render(this.quadScene, this.quadCam);
      };

      try {
        const gl = this.renderer.getContext();
        this._halfFloat = !!gl.getExtension('EXT_color_buffer_half_float') ||
          !!gl.getExtension('EXT_color_buffer_float');
      } catch (e) { this._halfFloat = false; }
      if (!this._halfFloat) {
        this.sceneRT.texture.type = THREE.UnsignedByteType;
        this.brightRT.texture.type = THREE.UnsignedByteType;
        this.blurRT.texture.type = THREE.UnsignedByteType;
      }
    },

    setBloom(on) {
      this.bloomEnabled = on;
      this.renderer.toneMapping = on ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      this.renderer.outputColorSpace = on ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
    },

    resize() {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      this.width = w; this.height = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
      this.dpr = dpr;
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      const bw = Math.max(2, Math.floor(w * dpr * 0.5));
      const bh = Math.max(2, Math.floor(h * dpr * 0.5));
      this.sceneRT.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
      this.brightRT.setSize(bw, bh);
      this.blurRT.setSize(bw, bh);
      this.compMat.uniforms.uAspect.value = w / h;
    },

    /* ---------- 场景登记 ---------- */
    addScene(name, scene) {
      this.scenes[name] = scene;
    },

    setScene(name) {
      const s = this.scenes[name];
      if (!s) return;
      this.activeName = name;
      this.active = s;
      this.pickables = s.pickables || [];
      this.lens.set(0.5, 0.5, 0.1, 0);
      this.bloomStrength = s.bloom !== undefined ? s.bloom : 0.85;
      this.exposure = s.exposure !== undefined ? s.exposure : 1;
      this.camera.near = s.near || 0.1;
      this.camera.far = s.far || 900;
      this.camera.fov = s.fov || 52;
      this.camera.updateProjectionMatrix();
      this.rig.setLimits(s.minRadius || 0.5, s.maxRadius || 500);
      if (s.enter) s.enter(this);
      this._syncLabels();
      if (this.onSceneChange) this.onSceneChange(name);
    },

    /* ---------- 标签 ---------- */
    _syncLabels() {
      const layer = this.labelLayer;
      layer.innerHTML = '';
      this.labels = (this.active && this.active.labels) ? this.active.labels : [];
      for (const l of this.labels) {
        const el = document.createElement('button');
        el.className = 'label' + (l.cls ? ' ' + l.cls : '');
        el.type = 'button';
        el.innerHTML = '<i></i><span>' + l.text + '</span>';
        el.dataset.id = l.id;
        el.addEventListener('click', e => {
          e.stopPropagation();
          if (this.onPick) this.onPick(l.id, true);
        });
        layer.appendChild(el);
        l.el = el;
      }
    },

    _updateLabels() {
      if (!this.labels || !this.labels.length) return;
      const w = this.width, h = this.height;
      const v = new THREE.Vector3();
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      for (const l of this.labels) {
        const p = l.pos();
        if (!p) { l.el.style.opacity = 0; continue; }
        v.copy(p);
        const world = v.clone();
        v.project(this.camera);
        const behind = v.z > 1 || v.z < -1;
        const onScreen = v.x > -1.15 && v.x < 1.15 && v.y > -1.15 && v.y < 1.15;
        if (behind || !onScreen) {
          l.el.style.opacity = 0;
          l.el.style.pointerEvents = 'none';
          continue;
        }
        const dist = world.distanceTo(this.camera.position);
        const fade = l.maxDist ? clamp(1 - (dist - l.maxDist) / (l.maxDist * 0.5), 0, 1) : 1;
        l.el.style.opacity = fade.toFixed(2);
        l.el.style.pointerEvents = fade > 0.15 ? 'auto' : 'none';
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        l.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        l.el.classList.toggle('dim', !!l.activeId && this.active && this.active.selectedId && l.activeId !== this.active.selectedId);
      }
    },

    /* ---------- 交互 ---------- */
    _bindEvents() {
      window.addEventListener('resize', () => this.resize());
      this.canvas.addEventListener('pointerup', e => {
        if (this.rig.moved > 6) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.pickables, true);
        if (hits.length) {
          let o = hits[0].object;
          while (o && !o.userData.pickId) o = o.parent;
          if (o && this.onPick) this.onPick(o.userData.pickId, false);
        }
      });
    },

    /* ---------- 主循环 ---------- */
    loop() {
      requestAnimationFrame(() => this.loop());
      if (document.hidden) return;
      const dt = Math.min(this.clock.getDelta(), 0.06);
      if (!this.active) return;
      this.elapsed += dt;

      this.rig.update(dt);
      if (this.active && this.active.update) this.active.update(dt, this.elapsed);
      this._updateLabels();

      // 镜头参数（黑洞引力透镜）
      if (this.active && this.active.updateLens) {
        this.active.updateLens(this);
      } else {
        this.lens.w = 0;
      }

      const r = this.renderer;
      if (this.bloomEnabled) {
        r.setRenderTarget(this.sceneRT);
        r.clear();
        r.render(this.active.scene, this.camera);

        this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
        this.brightMat.uniforms.uThreshold.value = this.active && this.active.bloomThreshold !== undefined ? this.active.bloomThreshold : 0.55;
        this._pass(this.brightMat, this.brightRT);

        const t = this.brightRT.texture;
        this.blurMat.uniforms.tDiffuse.value = t;
        this.blurMat.uniforms.uDir.value.set(1.4 / this.brightRT.width, 0);
        this._pass(this.blurMat, this.blurRT);
        this.blurMat.uniforms.tDiffuse.value = this.blurRT.texture;
        this.blurMat.uniforms.uDir.value.set(0, 1.4 / this.brightRT.height);
        this._pass(this.blurMat, this.brightRT);

        this.compMat.uniforms.tScene.value = this.sceneRT.texture;
        this.compMat.uniforms.tBloom.value = this.brightRT.texture;
        this.compMat.uniforms.uBloom.value = this.bloomStrength;
        this.compMat.uniforms.uExposure.value = this.exposure;
        this.compMat.uniforms.uTime.value = this.elapsed;
        this._pass(this.compMat, null);
      } else {
        r.setRenderTarget(null);
        r.render(this.active.scene, this.camera);
      }
    },

    /* 开发/QA：把完整合成（含泛光）渲染进离屏 RT 并返回 PNG dataURL。
       不依赖浏览器合成器，可无头校验最终画面。 */
    snapshot(w, h) {
      if (!this.active) return null;
      const r = this.renderer;
      /* 离屏渲染的分辨率比画布高时，点精灵要同比放大，否则星点显得又小又稀 */
      const k = w / Math.max(1, this.width);
      const touched = [];
      if (Math.abs(k - 1) > 0.02) {
        this.active.scene.traverse(o => {
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          mats.forEach(mat => {
            if (!mat.uniforms) return;
            ['uPixel', 'uScale'].forEach(key => {
              const u = mat.uniforms[key];
              if (!u || typeof u.value !== 'number') return;
              const bk = 'base' + key;
              if (mat.userData[bk] === undefined) mat.userData[bk] = u.value;
              touched.push([u, u.value]);
              u.value = mat.userData[bk] * k;
            });
          });
        });
      }
      const prevTarget = r.getRenderTarget();
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
      r.setRenderTarget(this.sceneRT);
      r.clear();
      r.render(this.active.scene, this.camera);

      this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
      this.brightMat.uniforms.uThreshold.value = this.active.bloomThreshold !== undefined ? this.active.bloomThreshold : 0.55;
      this._pass(this.brightMat, this.brightRT);
      this.blurMat.uniforms.tDiffuse.value = this.brightRT.texture;
      this.blurMat.uniforms.uDir.value.set(1.4 / this.brightRT.width, 0);
      this._pass(this.blurMat, this.blurRT);
      this.blurMat.uniforms.tDiffuse.value = this.blurRT.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1.4 / this.brightRT.height);
      this._pass(this.blurMat, this.brightRT);

      this.compMat.uniforms.tScene.value = this.sceneRT.texture;
      this.compMat.uniforms.tBloom.value = this.brightRT.texture;
      this.compMat.uniforms.uBloom.value = this.bloomStrength;
      this.compMat.uniforms.uExposure.value = this.exposure;
      this.compMat.uniforms.uTime.value = this.elapsed;
      this._pass(this.compMat, rt);

      const buf = new Uint8Array(w * h * 4);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      r.setRenderTarget(prevTarget);
      touched.forEach(t => { t[0].value = t[1]; });
      rt.dispose();

      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      const img = cx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const src = ((h - 1 - y) * w) * 4;
        const dst = y * w * 4;
        for (let x = 0; x < w * 4; x++) img.data[dst + x] = buf[src + x];
      }
      cx.putImageData(img, 0, 0);
      return cv.toDataURL('image/png');
    },

    projectToScreen(v3) {
      const v = v3.clone().project(this.camera);
      return {
        x: (v.x * 0.5 + 0.5) * this.width,
        y: (-v.y * 0.5 + 0.5) * this.height,
        visible: v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1
      };
    }
  };

  /* ---------------- 通用星空 ---------------- */
  function makeStarfield(opts) {
    opts = opts || {};
    const count = opts.count || 9000;
    const radius = opts.radius || 2600;
    const spread = opts.spread || 1;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const rnd = C3D.noise.mulberry32(opts.seed || 42);
    const palette = [
      [0.68, 0.80, 1.0], [0.80, 0.87, 1.0], [1.0, 1.0, 1.0],
      [1.0, 0.95, 0.84], [1.0, 0.84, 0.62], [1.0, 0.70, 0.52]
    ];
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * TAU;
      const r = radius * (0.85 + rnd() * 0.3) * spread;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u * (opts.flat ? 0.55 : 1);
      pos[i * 3 + 2] = r * s * Math.sin(th);
      const p = palette[(rnd() * palette.length) | 0];
      const b = 0.45 + Math.pow(rnd(), 3.2) * 0.75;
      col[i * 3] = p[0] * b; col[i * 3 + 1] = p[1] * b; col[i * 3 + 2] = p[2] * b;
      size[i] = 0.7 + Math.pow(rnd(), 5) * 3.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: C3D.Tex.dot() },
        uPixel: { value: window.devicePixelRatio || 1 },
        uTime: { value: 0 }
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vTw;
        void main(){
          vColor = aColor;
          vTw = 0.85 + 0.15 * sin(position.x * 0.13 + position.y * 0.07);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float att = clamp(520.0 / max(1.0, -mv.z), 0.45, 1.15);
          gl_PointSize = clamp(aSize * uPixel * 1.5 * att, 1.1, 8.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec3 vColor;
        varying float vTw;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.01) discard;
          gl_FragColor = vec4(vColor * vTw, t.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  /* ---------------- 星空穹顶（银河带） ---------------- */
  function makeSkyDome(radius) {
    const W = 2048, H = 1024;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);
    const rnd = C3D.noise.mulberry32(90210);

    // 银河带：沿一条倾斜的大圆
    const bandPoints = 2600;
    for (let i = 0; i < bandPoints; i++) {
      const t = i / bandPoints;
      const lon = t * TAU;
      const lat = Math.sin(lon * 1.0 + 0.6) * 0.18 + Math.sin(lon * 2.3) * 0.05;
      const x = ((lon / TAU) % 1) * W;
      const y = (0.5 - lat / Math.PI) * H;
      const w = 40 + 90 * Math.pow(rnd(), 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, w);
      const warm = rnd() > 0.55;
      const col = warm ? '255,228,190' : '190,210,255';
      g.addColorStop(0, 'rgba(' + col + ',' + (0.09 + rnd() * 0.10) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
    }
    // 星尘颗粒
    for (let i = 0; i < 42000; i++) {
      const x = rnd() * W;
      const band = Math.sin((x / W) * TAU + 0.6) * 0.18;
      const y = (0.5 - band / Math.PI) * H + (rnd() - 0.5) * H * (0.05 + rnd() * 0.22);
      const a = 0.14 + rnd() * 0.46;
      const s = rnd() < 0.94 ? 1 : 2;
      ctx.fillStyle = 'rgba(' + (210 + rnd() * 45 | 0) + ',' + (215 + rnd() * 40 | 0) + ',255,' + a + ')';
      ctx.fillRect(x, y, s, s);
    }
    // 暗尘带
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W;
      const band = Math.sin((x / W) * TAU + 0.6) * 0.18;
      const y = (0.5 - band / Math.PI) * H + (rnd() - 0.5) * 26;
      const w = 50 + rnd() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, w);
      g.addColorStop(0, 'rgba(4,5,14,0.55)');
      g.addColorStop(1, 'rgba(4,5,14,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius || 3600, 48, 32),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false })
    );
    mesh.rotation.z = 0.4;
    mesh.rotation.x = 0.3;
    mesh.renderOrder = -10;
    return mesh;
  }

  C3D.Core = Core;
  C3D.makeStarfield = makeStarfield;
  C3D.makeSkyDome = makeSkyDome;
  C3D.Rig = Rig;
})();
