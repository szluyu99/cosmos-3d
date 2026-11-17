/* ============================================================
   COSMOS 3D — 深空：黑洞 / 蟹状星云 / 星系并合
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;

  const BH_POS = new THREE.Vector3(0, 0, 0);
  const CRAB_POS = new THREE.Vector3(540, 70, -240);
  const MERGE_POS = new THREE.Vector3(-480, -50, 320);

  function makeRingTex(inner, outer, color) {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, S * inner, S / 2, S / 2, S * outer);
    g.addColorStop(0, 'rgba(' + color + ',0)');
    g.addColorStop(0.45, 'rgba(' + color + ',0.9)');
    g.addColorStop(0.6, 'rgba(' + color + ',0.25)');
    g.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const NOISE_GLSL = `
    float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
      return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
    }
    float fbm(vec2 p){
      float s = 0.0, a = 0.5;
      for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; }
      return s;
    }
  `;

  /* ---------- 点云着色器（星系） ---------- */
  function galaxyPoints(count, R, seed, opts) {
    opts = opts || {};
    const geo = new THREE.BufferGeometry();
    const aR = new Float32Array(count), aA = new Float32Array(count);
    const aH = new Float32Array(count), aC = new Float32Array(count * 3);
    const aS = new Float32Array(count);
    const rnd = C3D.noise.mulberry32(seed);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let r, ang, h;
      if (rnd() < 0.22) {
        r = Math.pow(rnd(), 0.6) * R * 0.18;
        ang = rnd() * TAU;
        h = (rnd() - 0.5) * R * 0.06;
        col.setRGB(1.0, 0.85, 0.62);
        aS[i] = 0.8 + rnd() * 1.6;
      } else {
        r = R * 0.16 + Math.pow(rnd(), 0.62) * R * 0.84;
        const arm = opts.arms === 2 ? (rnd() < 0.5 ? 0 : Math.PI) : (rnd() * 3 | 0) * (TAU / 3);
        ang = arm + Math.log(Math.max(1.05, r / (R * 0.14))) * (opts.twist || 3.0) +
          (rnd() - 0.5) * (0.55 + 0.5 * (1 - r / R));
        h = (rnd() - 0.5) * (1.2 + R * 0.04);
        const t = r / R;
        col.setRGB(0.62 + 0.38 * (1 - t), 0.76 + 0.2 * (1 - t), 1.0);
      }
      aR[i] = r; aA[i] = ang; aH[i] = h;
      aC[i * 3] = col.r; aC[i * 3 + 1] = col.g; aC[i * 3 + 2] = col.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
    geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    geo.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
    geo.setAttribute('aC', new THREE.BufferAttribute(aC, 3));
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio || 1, 2) },
        uTex: { value: C3D.Tex.dot() }, uSpin: { value: opts.spin || 0.25 },
        uScale: { value: opts.scale || 1 }
      },
      vertexShader: `
        attribute float aR; attribute float aA; attribute float aH;
        attribute vec3 aC; attribute float aS;
        uniform float uTime, uPixel, uSpin, uScale;
        varying vec3 vC;
        void main(){
          float ang = aA + uTime * uSpin;
          vec3 p = vec3(cos(ang)*aR, aH, sin(ang)*aR);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aS * uScale * uPixel * (240.0/max(1.0,-mv.z)), 0.7, 10.0);
          vC = aC;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex; varying vec3 vC;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vC, t.a * 0.95);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  function build(Core) {
    const scene = new THREE.Scene();
    const labels = [];
    const pickables = [];

    scene.add(C3D.makeSkyDome(4200));
    const stars = C3D.makeStarfield({ count: 14000, radius: 3200, seed: 77 });
    scene.add(stars);

    /* ============================================================
       黑洞
       ============================================================ */
    const bhGroup = new THREE.Group();
    bhGroup.position.copy(BH_POS);
    scene.add(bhGroup);

    const HORIZON = 9.2;
    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(HORIZON, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    bhGroup.add(horizon);

    // 视界边缘微光
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(HORIZON * 1.06, 64, 40),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xbfe6ff) } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main(){
            float rim = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.0);
            gl_FragColor = vec4(uColor, rim * 0.65);
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide
      })
    );
    bhGroup.add(rim);

    // 吸积盘
    const diskGeo = new THREE.RingGeometry(HORIZON * 1.25, 30, 220, 16);
    const diskMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: NOISE_GLSL + `
        uniform float uTime; varying vec3 vP;
        void main(){
          float r = length(vP.xy);
          float a = atan(vP.y, vP.x);
          float inner = 11.5, outer = 30.0;
          float t = uTime * 0.5;
          float bands = fbm(vec2(a * 3.4 + r * 0.22 - t, r * 0.42 + a * 0.6));
          float n = 0.45 + 0.9 * bands;
          float radial = smoothstep(inner, inner + 2.6, r) * (1.0 - smoothstep(outer * 0.62, outer, r));
          float dop = 0.45 + 1.05 * smoothstep(-0.4, 1.0, cos(a - 0.6));
          vec3 c = mix(vec3(0.42, 0.07, 0.02), vec3(1.0, 0.52, 0.12), smoothstep(inner, 26.0, r));
          c = mix(c, vec3(1.0, 0.95, 0.85), smoothstep(inner, inner + 2.0, r) * 0.7);
          float alpha = radial * clamp(n, 0.0, 1.4) * dop;
          gl_FragColor = vec4(c * (0.72 + n * 0.55), alpha * 0.85);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = -Math.PI / 2 + 0.34;
    disk.rotation.z = 0.12;
    bhGroup.add(disk);

    // 光子环（面向相机）
    const photonRing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeRingTex(0.34, 0.5, '255,240,214'),
      transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending
    }));
    photonRing.scale.set(HORIZON * 2.9, HORIZON * 2.9, 1);
    bhGroup.add(photonRing);

    const bhGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,190,120,0.55)', 'rgba(255,120,40,0.02)'),
      transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    bhGlow.scale.set(46, 46, 1);
    bhGroup.add(bhGlow);

    labels.push({ id: 'bh', text: '黑洞 · 事件视界', cls: 'label-sun', maxDist: 1600, pos: () => BH_POS.clone().add(new THREE.Vector3(0, 16, 0)) });

    function pickSphere(parent, pos, radius, id) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
      );
      m.position.copy(pos);
      m.userData.pickId = id;
      parent.add(m);
      pickables.push(m);
      return m;
    }
    pickSphere(bhGroup, new THREE.Vector3(0, 0, 0), 26, 'bh');

    /* ============================================================
       蟹状星云
       ============================================================ */
    const crabGroup = new THREE.Group();
    crabGroup.position.copy(CRAB_POS);
    scene.add(crabGroup);

    const crabCount = 30000;
    const crabGeo = new THREE.BufferGeometry();
    const cp = new Float32Array(crabCount * 3);
    const cc = new Float32Array(crabCount * 3);
    const cs = new Float32Array(crabCount);
    const rnd = C3D.noise.mulberry32(1054);
    const col = new THREE.Color();
    const palettes = [
      [0.55, 0.95, 1.0], [0.45, 0.80, 1.0], [1.0, 0.72, 0.42],
      [1.0, 0.55, 0.55], [0.85, 0.60, 1.0]
    ];
    let k = 0;
    // 丝状体：从中心放射并卷曲
    const filaments = 90;
    const perF = Math.floor(crabCount / filaments);
    for (let f = 0; f < filaments; f++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * TAU;
      const sq = Math.sqrt(1 - u * u);
      const dx = sq * Math.cos(th), dy = u, dz = sq * Math.sin(th);
      // 垂直于方向的卷曲轴
      const ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const L = 26 + rnd() * 26;
      const twist = (rnd() - 0.5) * 2.4;
      const pc = palettes[(rnd() * palettes.length) | 0];
      for (let j = 0; j < perF && k < crabCount; j++, k++) {
        const t = Math.pow(j / perF, 0.65);
        const rr = L * t;
        const v = new THREE.Vector3(dx, dy, dz).multiplyScalar(rr);
        const q = new THREE.Quaternion().setFromAxisAngle(ax, twist * t);
        v.applyQuaternion(q);
        const spread = 0.6 + t * 5.0;
        v.x += (rnd() - 0.5) * spread;
        v.y += (rnd() - 0.5) * spread;
        v.z += (rnd() - 0.5) * spread;
        cp[k * 3] = v.x; cp[k * 3 + 1] = v.y; cp[k * 3 + 2] = v.z;
        const bright = 0.55 + rnd() * 0.5;
        col.setRGB(pc[0] * bright, pc[1] * bright, pc[2] * bright);
        cc[k * 3] = col.r; cc[k * 3 + 1] = col.g; cc[k * 3 + 2] = col.b;
        cs[k] = 1.1 + Math.pow(rnd(), 4) * 4.5;
      }
    }
    for (; k < crabCount; k++) {
      // 弥散气体
      const r = Math.pow(rnd(), 0.55) * 34;
      const u = rnd() * 2 - 1, th = rnd() * TAU, sq = Math.sqrt(1 - u * u);
      cp[k * 3] = r * sq * Math.cos(th);
      cp[k * 3 + 1] = r * u * 0.8;
      cp[k * 3 + 2] = r * sq * Math.sin(th);
      const pc = palettes[(rnd() * 3) | 0];
      const b = 0.25 + rnd() * 0.35;
      cc[k * 3] = pc[0] * b; cc[k * 3 + 1] = pc[1] * b; cc[k * 3 + 2] = pc[2] * b;
      cs[k] = 1.0 + rnd() * 3.0;
    }
    crabGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    crabGeo.setAttribute('aColor', new THREE.BufferAttribute(cc, 3));
    crabGeo.setAttribute('aSize', new THREE.BufferAttribute(cs, 1));
    const crabMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: C3D.Tex.soft() }, uPixel: { value: Math.min(devicePixelRatio || 1, 2) }
      },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize;
        uniform float uPixel; varying vec3 vC;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uPixel * (230.0/max(1.0,-mv.z)), 0.8, 26.0);
          vC = aColor;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex; varying vec3 vC;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vC, t.a * 0.5);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const crab = new THREE.Points(crabGeo, crabMat);
    crab.frustumCulled = false;
    crabGroup.add(crab);

    // 星云整体辉光
    const crabGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.nebula ? C3D.Tex.nebula(0.52) : C3D.Tex.glow('rgba(120,220,255,0.35)', 'rgba(60,120,255,0.02)'),
      transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    crabGlow.scale.set(120, 120, 1);
    crabGroup.add(crabGlow);

    // 脉冲星
    const pulsar = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xe6fbff })
    );
    crabGroup.add(pulsar);
    const pulsarGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(220,250,255,1)', 'rgba(120,220,255,0.08)'),
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    pulsarGlow.scale.set(12, 12, 1);
    crabGroup.add(pulsarGlow);
    // 双极束
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.10, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const beamGeo = new THREE.ConeGeometry(6, 46, 24, 1, true);
    const beamA = new THREE.Mesh(beamGeo, beamMat);
    beamA.position.y = 23;
    const beamB = new THREE.Mesh(beamGeo, beamMat);
    beamB.position.y = -23;
    beamB.rotation.z = Math.PI;
    const beams = new THREE.Group();
    beams.add(beamA, beamB);
    beams.rotation.z = 0.5;
    crabGroup.add(beams);

    labels.push({ id: 'crab', text: '蟹状星云 · 超新星遗迹', cls: 'label-arm', maxDist: 1600, pos: () => CRAB_POS.clone().add(new THREE.Vector3(0, 34, 0)) });
    pickSphere(crabGroup, new THREE.Vector3(0, 0, 0), 42, 'crab');

    /* ============================================================
       星系并合
       ============================================================ */
    const mergeGroup = new THREE.Group();
    mergeGroup.position.copy(MERGE_POS);
    mergeGroup.rotation.y = 0.4;
    scene.add(mergeGroup);

    const gA = galaxyPoints(26000, 44, 4038, { arms: 2, twist: 3.2, spin: 0.35 });
    gA.position.set(-23, 0, 2);
    gA.rotation.set(0.35, 0, 0.18);
    const gB = galaxyPoints(20000, 34, 4039, { arms: 2, twist: 2.8, spin: -0.4 });
    gB.position.set(30, 6, 10);
    gB.rotation.set(-0.25, 0.7, -0.12);
    mergeGroup.add(gA, gB);

    // 潮汐桥
    const bridgeCount = 8000;
    const bgeo = new THREE.BufferGeometry();
    const bp = new Float32Array(bridgeCount * 3);
    const bc = new Float32Array(bridgeCount * 3);
    const bs = new Float32Array(bridgeCount);
    const brnd = C3D.noise.mulberry32(777);
    const bcol = new THREE.Color();
    for (let i = 0; i < bridgeCount; i++) {
      const t = brnd();
      const arc = Math.sin(t * Math.PI) * (18 + brnd() * 12);
      const x = -26 + t * 60 + (brnd() - 0.5) * 10;
      const y = 4 + arc * (0.6 + brnd() * 0.5) + (brnd() - 0.5) * 10;
      const z = 6 + (brnd() - 0.5) * 26;
      bp[i * 3] = x; bp[i * 3 + 1] = y; bp[i * 3 + 2] = z;
      const b = 0.4 + brnd() * 0.6;
      bcol.setRGB(0.85 * b, 0.88 * b, 1.0 * b);
      bc[i * 3] = bcol.r; bc[i * 3 + 1] = bcol.g; bc[i * 3 + 2] = bcol.b;
      bs[i] = 0.8 + brnd() * 2.2;
    }
    bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bgeo.setAttribute('aColor', new THREE.BufferAttribute(bc, 3));
    bgeo.setAttribute('aSize', new THREE.BufferAttribute(bs, 1));
    const bridge = new THREE.Points(bgeo, crabMat.clone());
    bridge.frustumCulled = false;
    mergeGroup.add(bridge);

    const mGlowA = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,225,180,0.6)', 'rgba(255,170,90,0.02)'),
      transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    mGlowA.position.set(-26, 0, 0);
    mGlowA.scale.set(42, 42, 1);
    mergeGroup.add(mGlowA);
    const mGlowB = mGlowA.clone();
    mGlowB.material = mGlowA.material.clone();
    mGlowB.position.set(34, 6, 12);
    mGlowB.scale.set(34, 34, 1);
    mergeGroup.add(mGlowB);

    labels.push({ id: 'merger', text: '星系并合 · 触须星系', cls: 'label-arm', maxDist: 1800, pos: () => MERGE_POS.clone().add(new THREE.Vector3(0, 46, 0)) });
    pickSphere(mergeGroup, new THREE.Vector3(0, 0, 0), 60, 'merger');

    /* ---------- 状态 ---------- */
    const state = { selectedId: 'bh' };

    const api = {
      name: 'deep',
      scene, labels, pickables,
      near: 0.2, far: 6000,
      minRadius: 14, maxRadius: 2200,
      bloom: 1.05, exposure: 1.06, bloomThreshold: 0.42,
      timeControl: false,
      selectedId: 'bh',
      state,
      getState: () => state,

      enter() {
        Core.rig.snap(BH_POS, 68, 0.55, 1.32);
        Core.rig.follow = null;
      },

      update(dt, t) {
        diskMat.uniforms.uTime.value += dt;
        gA.material.uniforms.uTime.value += dt;
        gB.material.uniforms.uTime.value += dt;
        pulsarGlow.material.opacity = 0.6 + Math.abs(Math.sin(t * 4.6)) * 0.4;
        const ps = 11 + Math.sin(t * 4.6) * 1.6;
        pulsarGlow.scale.set(ps, ps, 1);
        beams.rotation.y += dt * 1.6;
        crab.rotation.y += dt * 0.012;
        photonRing.material.rotation = 0;
        bhGlow.material.opacity = 0.5 + Math.sin(t * 0.8) * 0.08;
        stars.rotation.y += dt * 0.0003;
      },

      // 引力透镜：把黑洞屏幕位置和视界半径交给合成着色器
      updateLens(Core) {
        const cam = Core.camera;
        const center = BH_POS.clone().project(cam);
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const edge = BH_POS.clone().add(right.multiplyScalar(HORIZON * 1.28)).project(cam);
        const u = center.x * 0.5 + 0.5;
        const v = center.y * 0.5 + 0.5;
        const rs = Math.abs(edge.x - center.x) * 0.5;
        const dist = cam.position.distanceTo(BH_POS);
        const strength = Math.min(1, 60 / Math.max(20, dist)) * 1.35;
        const inView = center.z < 1 && u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98;
        if (inView) {
          Core.lens.set(u, v, Math.max(0.012, rs), Math.min(1.2, strength));
        } else {
          Core.lens.w = 0;
        }
      },

      focus(id, opts) {
        state.selectedId = id;
        api.selectedId = id;
        const dur = opts && opts.instant ? 0.01 : 1.9;
        if (id === 'bh') {
          Core.rig.flyTo(BH_POS, 68, { duration: dur, theta: 0.55, phi: 1.32 });
        } else if (id === 'crab') {
          Core.rig.flyTo(CRAB_POS, 105, { duration: dur, theta: 0.9, phi: 1.18 });
        } else if (id === 'merger') {
          Core.rig.flyTo(MERGE_POS.clone().add(new THREE.Vector3(3, 4, 4)), 142, { duration: dur, theta: 0.75, phi: 1.12 });
        }
        Core.rig.follow = null;
      },

      reset() {
        state.selectedId = 'bh';
        Core.rig.flyTo(BH_POS, 68, { duration: 1.6, theta: 0.55, phi: 1.32 });
      }
    };

    return api;
  }

  C3D.buildDeep = build;
})();
