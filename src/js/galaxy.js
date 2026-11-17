/* ============================================================
   COSMOS 3D — 银河系
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;
  const R = 100;
  const SUN_R = 55;
  const SUN_ANG = 0.62;

  function ringTex() {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(140,220,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,220,255,0.25)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.34, 0, TAU); ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function gauss(rnd) {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function build(Core) {
    const scene = new THREE.Scene();
    const labels = [];
    const pickables = [];

    // 背景
    scene.add(C3D.makeSkyDome(3000));
    const stars = C3D.makeStarfield({ count: 9000, radius: 1600, seed: 21 });
    scene.add(stars);

    // 远处星系
    const gTex = C3D.Tex.glow('rgba(210,228,255,0.9)', 'rgba(120,160,255,0.05)');
    const grnd = C3D.noise.mulberry32(555);
    for (let i = 0; i < 42; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: gTex, color: new THREE.Color().setHSL(0.55 + grnd() * 0.12, 0.35, 0.6),
        transparent: true, opacity: 0.12 + grnd() * 0.2, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      const u = grnd() * 2 - 1, th = grnd() * TAU;
      const r = 1200 + grnd() * 500;
      const sq = Math.sqrt(1 - u * u);
      s.position.set(r * sq * Math.cos(th), r * u * 0.8, r * sq * Math.sin(th));
      const sc = 18 + grnd() * 55;
      s.scale.set(sc, sc * (0.35 + grnd() * 0.5), 1);
      s.material.rotation = grnd() * TAU;
      scene.add(s);
    }

    /* ---------- 星系粒子 ---------- */
    const COUNT = 120000;
    const geo = new THREE.BufferGeometry();
    const aRadius = new Float32Array(COUNT);
    const aAngle = new Float32Array(COUNT);
    const aHeight = new Float32Array(COUNT);
    const aColor = new Float32Array(COUNT * 3);
    const aSize = new Float32Array(COUNT);
    const rnd = C3D.noise.mulberry32(20261116);
    const col = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const roll = rnd();
      let r, ang, h, c;
      if (roll < 0.20) {
        // 核球
        r = Math.pow(rnd(), 0.62) * 13;
        ang = rnd() * TAU;
        h = gauss(rnd) * (2.6 + 2.5 * (1 - r / 13));
        const t = 0.65 + rnd() * 0.35;
        c = col.setRGB(1.0 * t, 0.80 * t, 0.52 * t).clone();
        aSize[i] = 0.55 + Math.pow(rnd(), 4) * 1.8;
      } else if (roll < 0.965) {
        // 旋臂
        r = 8 + Math.pow(rnd(), 0.58) * (R - 8);
        const arm = (rnd() * 4) | 0;
        const major = arm < 2;
        const twist = Math.log(Math.max(1.01, r / 8)) * 3.35;
        const spread = (major ? 0.30 : 0.42) * (0.55 + 0.75 * (1 - r / R));
        ang = arm * (Math.PI / 2) + twist + gauss(rnd) * spread;
        h = gauss(rnd) * (1.2 + 3.4 * Math.exp(-r / 45));
        const t = r / R;
        const pink = rnd() < 0.035;
        if (pink) {
          c = col.setRGB(1.0, 0.42 + rnd() * 0.2, 0.62 + rnd() * 0.2).clone();
          aSize[i] = 2.2 + rnd() * 4.5;
        } else {
          c = col.setRGB(
            0.62 + 0.38 * (1 - t),
            0.74 + 0.22 * (1 - t),
            1.0
          ).clone();
          // 内圈偏暖
          if (t < 0.35) {
            c.lerp(new THREE.Color(1.0, 0.87, 0.66), (0.35 - t) / 0.35 * 0.8);
          }
          aSize[i] = 0.45 + Math.pow(rnd(), 5.0) * 2.4;
        }
      } else {
        // 银晕
        r = 25 + Math.pow(rnd(), 0.6) * 95;
        const u = rnd() * 2 - 1;
        const sq = Math.sqrt(1 - u * u);
        ang = rnd() * TAU;
        h = r * u * 0.55;
        r = r * sq;
        c = col.setRGB(0.72 + rnd() * 0.2, 0.70 + rnd() * 0.2, 0.95).clone();
        aSize[i] = 0.4 + Math.pow(rnd(), 5) * 1.2;
      }
      aRadius[i] = r;
      aAngle[i] = ang;
      aHeight[i] = h;
      aColor[i * 3] = c.r; aColor[i * 3 + 1] = c.g; aColor[i * 3 + 2] = c.b;
    }

    geo.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(aHeight, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uTex: { value: C3D.Tex.dot() },
        uSize: { value: 1.0 }
      },
      vertexShader: `
        attribute float aRadius;
        attribute float aAngle;
        attribute float aHeight;
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        uniform float uSize;
        varying vec3 vColor;
        void main(){
          float ang = aAngle + uTime * 0.020;
          vec3 p = vec3(cos(ang) * aRadius, aHeight, sin(ang) * aRadius);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uSize * uPixel * (260.0 / max(1.0, -mv.z));
          gl_PointSize = clamp(gl_PointSize, 0.7, 14.0);
          vColor = aColor;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec3 vColor;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vColor, t.a * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const galaxy = new THREE.Points(geo, mat);
    galaxy.frustumCulled = false;
    scene.add(galaxy);

    /* ---------- 核球光斑 ---------- */
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,238,200,0.95)', 'rgba(255,160,80,0.06)'),
      transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    coreGlow.scale.set(46, 46, 1);
    scene.add(coreGlow);
    const coreGlow2 = coreGlow.clone();
    coreGlow2.material = coreGlow.material.clone();
    coreGlow2.material.opacity = 0.5;
    coreGlow2.scale.set(16, 16, 1);
    scene.add(coreGlow2);

    /* ---------- 太阳位置标记 ---------- */
    const sunPos = new THREE.Vector3(Math.cos(SUN_ANG) * SUN_R, 0, Math.sin(SUN_ANG) * SUN_R);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTex(), color: 0x9fe6ff, transparent: true, opacity: 0.95,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
    }));
    marker.position.copy(sunPos);
    marker.scale.set(6, 6, 1);
    scene.add(marker);
    const markerDot = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(180,240,255,1)', 'rgba(80,180,255,0.1)'),
      transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    markerDot.position.copy(sunPos);
    markerDot.scale.set(4.5, 4.5, 1);
    scene.add(markerDot);

    // 太阳轨道
    const orbitPts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * TAU;
      orbitPts.push(new THREE.Vector3(Math.cos(a) * SUN_R, 0, Math.sin(a) * SUN_R));
    }
    const sunOrbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0x6fc7ff, transparent: true, opacity: 0.13, depthWrite: false })
    );
    scene.add(sunOrbit);

    /* ---------- 标签 ---------- */
    labels.push({ id: 'core', text: '银心 · 人马座 A*', cls: 'label-sun', maxDist: 900, pos: () => new THREE.Vector3(0, 4, 0) });
    labels.push({ id: 'sunpos', text: '太阳系在这里', cls: 'label-home', maxDist: 900, pos: () => sunPos.clone() });
    labels.push({ id: 'orion', text: '猎户臂', cls: 'label-arm', maxDist: 900, pos: () => new THREE.Vector3(Math.cos(1.02) * 72, 1, Math.sin(1.02) * 72) });
    labels.push({ id: 'perseus', text: '英仙臂', cls: 'label-arm', maxDist: 900, pos: () => new THREE.Vector3(Math.cos(3.55) * 88, 1, Math.sin(3.55) * 88) });
    labels.push({ id: 'halo', text: '银晕', cls: 'label-arm', maxDist: 900, pos: () => new THREE.Vector3(26, 72, -34) });

    const state = { selectedId: 'core' };

    const api = {
      name: 'galaxy',
      scene, labels, pickables,
      near: 0.5, far: 4200,
      minRadius: 12, maxRadius: 620,
      bloom: 0.95, exposure: 1.12, bloomThreshold: 0.5,
      timeControl: false,
      selectedId: 'core',
      getState: () => state,
      state,

      enter() {
        Core.rig.snap(new THREE.Vector3(0, 0, 0), 215, 0.72, 0.78);
        Core.rig.follow = null;
        mat.uniforms.uPixel.value = Math.min(window.devicePixelRatio || 1, 2);
      },

      update(dt, t) {
        mat.uniforms.uTime.value += dt;
        marker.material.opacity = 0.75 + Math.sin(t * 2.2) * 0.2;
        const s = 6 + Math.sin(t * 2.2) * 0.9;
        marker.scale.set(s, s, 1);
        stars.rotation.y += dt * 0.0004;
        // 背景星系轻微闪烁
      },

      focus(id, opts) {
        state.selectedId = id;
        api.selectedId = id;
        let p = new THREE.Vector3(), rad = 60;
        if (id === 'core') { p.set(0, 0, 0); rad = 34; }
        else if (id === 'sunpos') { p.copy(sunPos); rad = 16; }
        else if (id === 'orion') { p.set(Math.cos(1.02) * 72, 0, Math.sin(1.02) * 72); rad = 48; }
        else if (id === 'perseus') { p.set(Math.cos(3.55) * 88, 0, Math.sin(3.55) * 88); rad = 55; }
        else if (id === 'halo') { p.set(26, 72, -34); rad = 120; }
        Core.rig.follow = null;
        Core.rig.flyTo(p, rad, {
          duration: opts && opts.instant ? 0.01 : 1.7,
          theta: id === 'core' ? 0.9 : Core.rig.tTheta,
          phi: id === 'halo' ? 1.15 : 0.92
        });
      },

      reset() {
        Core.rig.follow = null;
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), 215, { duration: 1.5, theta: 0.72, phi: 0.78 });
      }
    };

    return api;
  }

  C3D.buildGalaxy = build;
})();
