/* ============================================================
   COSMOS 3D — 太阳系
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;
  const _hp = new THREE.Vector3();
  const DEG = Math.PI / 180;
  const START_MS = Date.UTC(2026, 10, 16, 12, 0, 0);

  const PLANETS = [
    { id: 'mercury', a: 0.387, period: 87.97, rotH: 1407.6, radius: 2439.7, tilt: 0.03, color: 0xb9b0a6, phase: 0.4, incl: 7.0 },
    { id: 'venus', a: 0.723, period: 224.7, rotH: -5832.5, radius: 6051.8, tilt: 177.4, color: 0xe8cfa0, phase: 2.1, incl: 3.4 },
    { id: 'earth', a: 1.0, period: 365.25, rotH: 23.93, radius: 6371, tilt: 23.44, color: 0x6fb3f2, phase: 0.9, incl: 0 },
    { id: 'mars', a: 1.524, period: 686.98, rotH: 24.62, radius: 3389.5, tilt: 25.19, color: 0xe0784f, phase: 3.5, incl: 1.85 },
    { id: 'jupiter', a: 5.203, period: 4332.6, rotH: 9.93, radius: 69911, tilt: 3.13, color: 0xd8b48a, phase: 5.2, incl: 1.3 },
    { id: 'saturn', a: 9.537, period: 10759, rotH: 10.66, radius: 58232, tilt: 26.73, color: 0xe6d5a8, phase: 1.6, incl: 2.49 },
    { id: 'uranus', a: 19.19, period: 30688, rotH: -17.24, radius: 25362, tilt: 97.77, color: 0x9fe0e8, phase: 4.1, incl: 0.77 },
    { id: 'neptune', a: 30.07, period: 60182, rotH: 16.11, radius: 24622, tilt: 28.32, color: 0x6f8ef2, phase: 2.8, incl: 1.77 }
  ];

  const orbitR = a => 13 * Math.pow(a, 0.55);
  const bodyR = rel => 0.78 * Math.pow(rel, 0.42);

  /* 真实比例：太阳半径 4.6 单位 = 696,340 km；1 AU = 62 单位 */
  const SUN_KM = 696340, SUN_UNITS = 4.6, AU_UNIT = 62;
  const realRadius = km => SUN_UNITS * km / SUN_KM;

  function ringGeometry(inner, outer, seg) {
    const g = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const ang = t * TAU;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      pos.push(ca * inner, 0, sa * inner, ca * outer, 0, sa * outer);
      uv.push(0, t, 1, t);
      if (i < seg) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function atmosphereMaterial(color) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uPower: { value: 2.6 },
        uStrength: { value: 0.55 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uStrength;
        varying vec3 vNormal;
        varying vec3 vView;
        void main(){
          float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), uPower);
          gl_FragColor = vec4(uColor * rim * uStrength, rim * uStrength);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false
    });
  }

  function build(Core) {
    const scene = new THREE.Scene();
    const objects = {};
    const labels = [];
    const pickables = [];

    scene.add(C3D.makeSkyDome(1200));
    const stars = C3D.makeStarfield({ count: 11000, radius: 950, seed: 7 });
    scene.add(stars);

    // 光照
    const sunLight = new THREE.PointLight(0xfff1d6, 2.35, 0, 0);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x334466, 0.55));
    const fill = new THREE.DirectionalLight(0x6688bb, 0.25);
    fill.position.set(-1, 0.6, 1);
    scene.add(fill);

    /* ---------- 太阳 ---------- */
    const sunGroup = new THREE.Group();
    scene.add(sunGroup);
    const sunTex = C3D.Tex.sun();
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 64, 48),
      new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffffff })
    );
    sunMesh.userData.pickId = 'sun';
    sunGroup.add(sunMesh);
    pickables.push(sunMesh);

    const glowTexA = C3D.Tex.glow('rgba(255,246,214,1)', 'rgba(255,150,50,0.30)');
    const glowTexB = C3D.Tex.glow('rgba(255,214,150,0.9)', 'rgba(255,110,30,0.14)');
    const halos = [];
    [[15, 1.0, glowTexA], [30, 0.62, glowTexB], [58, 0.34, glowTexB]].forEach(cfg => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cfg[2], color: 0xffffff, transparent: true, opacity: cfg[1],
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      }));
      s.scale.set(cfg[0], cfg[0], 1);
      sunGroup.add(s);
      halos.push(s);
    });
    objects.sun = { group: sunGroup, mesh: sunMesh, radius: 4.6, focus: 17 };

    /* ---------- 行星 ---------- */
    const planets = [];
    for (const cfg of PLANETS) {
      const R = bodyR(cfg.radius / 6371);
      const orbit = orbitR(cfg.a);
      const holder = new THREE.Group();      // 轨道倾角
      holder.rotation.x = cfg.incl * DEG;
      scene.add(holder);

      // 轨道线
      const pts = [];
      for (let i = 0; i <= 220; i++) {
        const ang = (i / 220) * TAU;
        pts.push(new THREE.Vector3(Math.cos(ang) * orbit, 0, Math.sin(ang) * orbit));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x8fd0ff, transparent: true, opacity: 0.2, depthWrite: false
      });
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      holder.add(orbitLine);

      const pivot = new THREE.Group();
      holder.add(pivot);

      const tilt = new THREE.Group();
      tilt.rotation.z = cfg.tilt * DEG;
      pivot.add(tilt);

      const mat = new THREE.MeshStandardMaterial({
        map: C3D.Tex.planet(cfg.id),
        roughness: 0.94,
        metalness: 0.0
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mat);
      mesh.userData.pickId = cfg.id;
      tilt.add(mesh);
      pickables.push(mesh);

      // 远距离可见的星球光点
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: C3D.Tex.glow(C3D.Tex.css(cfg.color), 'rgba(0,0,0,0)'),
        color: 0xffffff, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      }));
      halo.scale.set(R * 3.4, R * 3.4, 1);
      tilt.add(halo);
      objects['halo_' + cfg.id] = halo;

      // 气态行星的大气边缘
      let atmoMesh = null, ringMesh = null, cloudsMesh = null;
      if (cfg.id === 'earth' || cfg.id === 'uranus' || cfg.id === 'neptune' || cfg.id === 'venus') {
        const atmoColor = cfg.id === 'earth' ? 0x5fa8ff : (cfg.id === 'venus' ? 0xffd9a0 : 0x8fe6ff);
        const atmo = new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.035, 48, 32),
          atmosphereMaterial(atmoColor)
        );
        atmo.material.uniforms.uStrength.value = cfg.id === 'earth' ? 0.75 : 0.4;
        tilt.add(atmo);
        atmoMesh = atmo;
      }

      // 云层
      if (cfg.id === 'earth') {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.012, 64, 48),
          new THREE.MeshStandardMaterial({
            map: C3D.Tex.clouds(), transparent: true, opacity: 0.62,
            depthWrite: false, roughness: 1, metalness: 0
          })
        );
        tilt.add(clouds);
        objects.clouds = clouds;
        cloudsMesh = clouds;
      }

      // 土星环
      if (cfg.id === 'saturn') {
        const ring = new THREE.Mesh(
          ringGeometry(R * 1.35, R * 2.45, 192),
          new THREE.MeshStandardMaterial({
            map: C3D.Tex.ring(), transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthWrite: false, roughness: 0.9, metalness: 0
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.userData.pickId = 'saturn';
        tilt.add(ring);
        pickables.push(ring);
        ringMesh = ring;
      }

      const obj = {
        cfg, R, orbit, holder, pivot, tilt, mesh, orbitMat, orbitLine,
        ringMesh, atmoMesh, cloudsMesh,
        visOrbit: orbit,
        realOrbit: cfg.a * AU_UNIT,
        realScale: realRadius(cfg.radius) / R
      };
      objects[cfg.id] = { group: pivot, mesh, radius: R, focus: Math.max(3.2, R * 6.5) };

      // 地球的月球
      if (cfg.id === 'earth') {
        const moonPivot = new THREE.Group();
        pivot.add(moonPivot);
        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 32, 24),
          new THREE.MeshStandardMaterial({ map: C3D.Tex.planet('moon'), roughness: 0.95, metalness: 0 })
        );
        moonMesh.position.set(1.55, 0, 0);
        moonMesh.userData.pickId = 'moon';
        moonPivot.add(moonMesh);
        pickables.push(moonMesh);
        obj.moonPivot = moonPivot;
        obj.moonMesh = moonMesh;
        objects.moon = { group: moonMesh, mesh: moonMesh, radius: 0.17, focus: 1.4 };
      }

      // 木星的伽利略卫星
      if (cfg.id === 'jupiter') {
        const moonCfg = [
          { r: 0.075, d: 2.5, sp: 1.8, c: 0xd8c07a },
          { r: 0.066, d: 3.1, sp: 1.2, c: 0xd9d2c0 },
          { r: 0.09, d: 3.9, sp: 0.85, c: 0xb9a98f },
          { r: 0.084, d: 4.8, sp: 0.6, c: 0x8f8a80 }
        ];
        obj.moons = moonCfg.map(mc => {
          const g = new THREE.Group();
          pivot.add(g);
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(mc.r, 20, 16),
            new THREE.MeshStandardMaterial({ color: mc.c, roughness: 0.9 })
          );
          m.position.set(mc.d, 0, 0);
          g.add(m);
          return { g, m, d: mc.d, sp: mc.sp, a: Math.random() * TAU };
        });
      }

      planets.push(obj);

      // 标签
      labels.push({
        id: cfg.id,
        text: C3D.DATA.solar[cfg.id].cn,
        cls: 'label-planet',
        maxDist: 420,
        pos: () => pivot.getWorldPosition(new THREE.Vector3())
      });
    }

    labels.unshift({
      id: 'sun', text: '太阳', cls: 'label-sun', maxDist: 500,
      pos: () => new THREE.Vector3(0, 6.4, 0)
    });
    labels.push({
      id: 'belt', text: '小行星带', cls: 'label-minor', maxDist: 260,
      pos: () => new THREE.Vector3(0, 0.4, orbitR(2.7) * 0.98)
    });

    /* ---------- 小行星带 ---------- */
    const N = 3200;
    const beltGeo = new THREE.BufferGeometry();
    const bp = new Float32Array(N * 3);
    const bc = new Float32Array(N * 3);
    const rnd = C3D.noise.mulberry32(12345);
    for (let i = 0; i < N; i++) {
      const a = 2.06 + rnd() * 1.2;
      const r = orbitR(a) * (0.985 + rnd() * 0.03);
      const ang = rnd() * TAU;
      const y = (rnd() - 0.5) * 1.5 * (0.3 + rnd());
      bp[i * 3] = Math.cos(ang) * r;
      bp[i * 3 + 1] = y;
      bp[i * 3 + 2] = Math.sin(ang) * r;
      const t = 0.55 + rnd() * 0.45;
      bc[i * 3] = 0.62 * t;
      bc[i * 3 + 1] = 0.55 * t;
      bc[i * 3 + 2] = 0.46 * t;
    }
    beltGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    beltGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    const belt = new THREE.Points(beltGeo, new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false
    }));
    scene.add(belt);
    objects.belt = { group: belt, mesh: belt, radius: 0, focus: 46 };

    /* ---------- 状态 ---------- */
    const state = {
      selectedId: 'earth',
      simDays: 0,
      speed: 8,
      showOrbits: true,
      showLabels: true,
      real: false,
      mix: 0
    };

    /* ---------- 真实比例形变 ---------- */
    function applyReal(m) {
      for (const p of planets) {
        p.orbit = p.visOrbit + (p.realOrbit - p.visOrbit) * m;
        const s = 1 + (p.realScale - 1) * m;
        p.mesh.scale.setScalar(s);
        if (p.ringMesh) p.ringMesh.scale.setScalar(s);
        if (p.atmoMesh) p.atmoMesh.scale.setScalar(s);
        if (p.cloudsMesh) p.cloudsMesh.scale.setScalar(s);
        p.orbitLine.scale.setScalar(p.orbit / p.visOrbit);
        const halo = objects['halo_' + p.cfg.id];
        if (halo) halo.visible = m < 0.55;
        if (p.moonPivot) p.moonPivot.visible = m < 0.4;
        if (p.moons) for (const mm of p.moons) mm.g.visible = m < 0.4;
      }
      belt.visible = m < 0.4;
      stars.scale.setScalar(1 + m * 2.6);
      for (const l of labels) {
        if (l.baseDist === undefined) l.baseDist = l.maxDist;
        l.maxDist = l.baseDist * (1 + m * 60);
      }
    }

    function realCamera(on) {
      const cam = Core.camera;
      if (on) {
        cam.near = 0.03; cam.far = 30000;
        Core.rig.setLimits(0.12, 9000);
      } else {
        cam.near = 0.05; cam.far = 2600;
        Core.rig.setLimits(1.0, 480);
      }
      cam.updateProjectionMatrix();
    }

    const api = {
      name: 'solar',
      scene, objects, labels, pickables,
      near: 0.05, far: 2600,
      minRadius: 1.0, maxRadius: 480,
      bloom: 0.75, exposure: 1.02, bloomThreshold: 0.62,
      timeControl: true,
      selectedId: state.selectedId,
      getState: () => state,
      state,

      enter() {
        const r = Core.rig;
        r.snap(new THREE.Vector3(0, 0, 0), state.real ? 260 : 118, 0.58, 1.02);
        r.follow = null;
      },

      update(dt, t) {
        const scale = state.speed; // 天/秒 (1× = 2 天/秒)
        const simDt = state.speed > 0 ? dt * state.speed : 0;
        state.simDays += simDt;

        // 太阳
        sunGroup.rotation.y += dt * 0.02;
        sunTex.offset.x = (sunTex.offset.x + dt * 0.0035) % 1;
        const pulse = 1 + Math.sin(t * 1.1) * 0.012;
        const glowK = 1 - 0.93 * state.mix;   // 真实比例下光晕不能比太阳大几十倍
        for (let i = 0; i < halos.length; i++) {
          const base = [13, 26, 48][i] * glowK;
          halos[i].scale.set(base * pulse, base * pulse, 1);
        }

        // 真实比例渐变（0=观赏，1=真实）
        const want = state.real ? 1 : 0;
        if (state.mix !== want) {
          state.mix += (want - state.mix) * Math.min(1, dt * 2.4);
          if (Math.abs(state.mix - want) < 0.002) state.mix = want;
          applyReal(state.mix);
        }

        for (const p of planets) {
          const ang = p.cfg.phase + (state.simDays / p.cfg.period) * TAU;
          p.pivot.position.set(Math.cos(ang) * p.orbit, 0, Math.sin(ang) * p.orbit);
          // 远看是光点，近看收起光晕（否则行星像被雾包住）
          const halo = objects['halo_' + p.cfg.id];
          if (halo) {
            p.mesh.getWorldPosition(_hp);
            const dr = Core.camera.position.distanceTo(_hp) / p.R;
            halo.material.opacity = 0.5 * THREE.MathUtils.clamp((dr - 6) / 14, 0, 1) * (1 - state.mix);
          }
          // 自转（视觉上限，避免高速时糊成一片）
          const spin = 4.0 / Math.abs(p.cfg.rotH) * (p.cfg.rotH < 0 ? -1 : 1);
          p.tilt.rotation.y += dt * Math.min(0.9, Math.max(0.06, spin * 3));

          if (p.moonPivot) {
            const ma = state.simDays / 27.32 * TAU + 1.2;
            p.moonPivot.rotation.y = ma;
            p.moonPivot.rotation.z = 0.09;
          }
          if (p.moons) {
            for (const m of p.moons) {
              m.a += dt * m.sp * (state.speed > 0 ? 0.6 : 0);
              m.g.rotation.y = m.a;
            }
          }
        }
        if (objects.clouds) objects.clouds.rotation.y += dt * 0.018;
        belt.rotation.y += dt * 0.004 * (state.speed > 0 ? 1 : 0);
        stars.rotation.y += dt * 0.0006;

        // 轨道高亮
        for (const p of planets) {
          const on = p.cfg.id === state.selectedId;
          p.orbitMat.opacity = on ? 0.55 : (0.16 + 0.16 * state.mix);
          p.orbitMat.color.set(on ? 0x8ee7ff : 0x7dd3fc);
        }
      },

      setSpeed(v) { state.speed = v; },
      setOrbits(v) {
        state.showOrbits = v;
        for (const p of planets) p.orbitLine.visible = v;
      },
      setLabels(v) {
        state.showLabels = v;
        Core.labelLayer.style.display = v ? '' : 'none';
      },

      setRealScale(v) {
        v = !!v;
        if (state.real === v) return;
        state.real = v;
        api.real = v;
        Core.rig.follow = null;
        realCamera(v);
        if (v) {
          Core.rig.flyTo(new THREE.Vector3(0, 0, 0), 260, { duration: 2.4, theta: 0.72, phi: 1.04 });
        } else {
          state.selectedId = 'earth';
          api.selectedId = 'earth';
          Core.rig.flyTo(new THREE.Vector3(0, 0, 0), 118, { duration: 1.8, theta: 0.58, phi: 1.02 });
        }
      },

      realView(which) {
        if (!state.real) this.setRealScale(true);
        if (which === 'all') {
          Core.rig.follow = null;
          Core.rig.flyTo(new THREE.Vector3(0, 0, 0), 4400, { duration: 2.6, theta: 0.8, phi: 0.92 });
        } else if (which === 'sun') {
          this.focus('sun');
          Core.rig.flyTo(new THREE.Vector3(0, 0, 0), 13, { duration: 1.8, theta: 0.9, phi: 1.3 });
        } else if (which === 'earth') {
          this.focus('earth');
          Core.rig.flyTo(objects.earth.group.getWorldPosition(new THREE.Vector3()), 0.55, { duration: 2.2, theta: 0.8, phi: 1.1 });
        }
      },

      exitReal() {
        if (!state.real) return;
        state.real = false;
        api.real = false;
        state.mix = 0;
        applyReal(0);
        realCamera(false);
      },

      realInfo() {
        const ev = objects.earth.group.getWorldPosition(new THREE.Vector3());
        const dist = Core.camera.position.distanceTo(ev);
        const ang = 2 * realRadius(6371) / Math.max(0.01, dist);
        const px = ang / (2 * Math.tan(Core.camera.fov * Math.PI / 360)) * window.innerHeight;
        const auSun = Core.camera.position.length() / AU_UNIT;
        return { dist: dist, au: auSun, earthDist: dist, px: px, mix: state.mix, real: state.real };
      },

      focus(id, opts) {
        const o = objects[id];
        if (!o) return;
        state.selectedId = id;
        api.selectedId = id;
        const pos = o.group.getWorldPosition(new THREE.Vector3());
        const scl = o.mesh && o.mesh.scale ? o.mesh.scale.x : 1;
        const vr = id === 'sun' ? 4.6 : (o.radius || 0.1) * scl;
        const radius = id === 'belt' ? 46 : Math.max(vr * 5.5, state.real ? 0.22 : 1.1);
        Core.rig.follow = () => o.group.getWorldPosition(new THREE.Vector3());
        const phi = id === 'sun' ? 1.22 : (id === 'saturn' ? 0.62 : 0.95);
        // 把相机放到「向阳侧」再偏一点，避免看到黑夜面
        let theta = Core.rig.tTheta;
        if (id !== 'sun') {
          theta = Math.atan2(-pos.x, -pos.z) + 0.55;
        }
        Core.rig.flyTo(pos, radius, {
          duration: opts && opts.instant ? 0.01 : 1.6,
          theta,
          phi
        });
      },

      reset() {
        Core.rig.follow = null;
        state.selectedId = 'earth';
        api.selectedId = 'earth';
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), state.real ? 260 : 118, { duration: 1.4, theta: 0.58, phi: 1.02 });
      },

      dateLabel() {
        const d = new Date(START_MS + state.simDays * 86400000);
        return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
      }
    };

    return api;
  }

  C3D.buildSolar = build;
})();
