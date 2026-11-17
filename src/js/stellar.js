/* ============================================================
   COSMOS 3D — 恒星演化（赫罗图 + 时间轴）
   一颗恒星的一生：分子云 → 原恒星 → 主序 → 红巨星 → 抛射 → 残骸
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- 黑体色（Tanner Helland 近似）→ sRGB ---------- */
  function bbColor(kelvin) {
    const t = clamp(kelvin, 1000, 40000) / 100;
    let r, g, b;
    if (t <= 66) r = 255;
    else r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    if (t <= 66) g = 99.4708025861 * Math.log(t) - 161.1195681661;
    else g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
  }
  function bbHex(kelvin) {
    const c = bbColor(kelvin);
    const h = v => ('0' + Math.round(v * 255).toString(16)).slice(-2);
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
  }
  function bbLinear(kelvin) {
    const c = bbColor(kelvin);
    const col = new THREE.Color();
    col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    return col;
  }

  /* ---------- 显示半径：真实半径（R☉）→ 场景单位（对数压缩） ----------
     0.013 R☉（白矮星）→ 0.20        1 R☉ → 1.10
     200 R☉（红巨星）  → 10.6         1500 R☉ → 31.4
     致密天体单独给显示半径，并在资料里注明「已放大」 */
  const dispR = R => 1.1 * Math.pow(Math.max(R, 1e-6), 0.42);
  const COMPACT_DISP = { wd: 0.55, ns: 0.5, bh: 3.2 };

  /* ============================================================
     四条质量轨道
     R 以 R☉ 计，T 单位 K，L 以 L☉ 计
     ============================================================ */
  const TRACKS = [
    {
      id: 'red', cn: '红矮星', en: 'Red Dwarf', mass: 0.3, massLabel: '0.3 M☉',
      color: '#ff7a5c', short: '小质量 · 几乎不演化',
      tagline: '宇宙里最省油、也最长寿的恒星。',
      desc: '红矮星把氢烧得极慢，又靠整体对流不断把新的燃料送进核心。它的寿命长达数千亿年——比今天的宇宙年龄还长十几倍。所以宇宙里至今没有一颗红矮星死过。',
      stages: [
        { key: 'cloud', R: 1, T: 10, L: 0, kind: 'cloud', name: '分子云', dur: '约 1,000 万年', core: '—',
          note: '一团温度只有 10 K 的冷分子云，在自身引力下开始收缩。' },
        { key: 'proto', R: 3, T: 3000, L: 0.5, kind: 'proto', name: '原恒星', dur: '约 1 亿年', core: '尚未点燃氢',
          note: '收缩把引力能变成热，但核心温度还不够点燃氢。' },
        { key: 'ms', R: 0.3, T: 3200, L: 0.005, kind: 'ms', name: '主序星', dur: '约 3,000 亿年', core: '氢 → 氦（整体对流）',
          note: '整颗星都在对流，燃料被搅匀着用，因此烧得极慢、极省。' },
        { key: 'wd', R: 0.013, T: 8000, L: 0.0001, kind: 'wd', name: '氦白矮星', dur: '数百亿年起持续冷却', core: '电子简并压',
          note: '它不会膨胀成红巨星，只会慢慢收缩成一颗氦白矮星。这条路至今还没有一颗恒星走完。' }
      ]
    },
    {
      id: 'sunlike', cn: '类太阳恒星', en: 'Solar-type Star', mass: 1, massLabel: '1 M☉',
      color: '#ffd27a', short: '中等质量 · 我们的太阳',
      tagline: '我们的太阳，以及它 50 亿年后的样子。',
      desc: '像太阳这样的恒星，核心把氢聚变成氦，辐射压与引力精确平衡。氢烧完之后，核心收缩、外层膨胀——它会变成一颗吞掉水星和金星的 红巨星，最后脱去外壳，只留下一颗地球大小的白矮星。',
      stages: [
        { key: 'cloud', R: 1, T: 10, L: 0, kind: 'cloud', name: '分子云', dur: '约 3,000 万年', core: '—',
          note: '太阳诞生的地方：一团含氢、氦和微量重元素的冷云。' },
        { key: 'proto', R: 4, T: 4000, L: 2, kind: 'proto', name: '原恒星', dur: '约 5,000 万年', core: '尚未点燃氢',
          note: '原恒星沿吸积盘长大，并把多余的角动量沿两极甩出去——这就是双极外流。' },
        { key: 'ms', R: 1, T: 5772, L: 1, kind: 'ms', name: '主序星', dur: '约 100 亿年', core: '氢 → 氦（核心）',
          note: '此刻。核心每秒把 6 亿吨氢变成氦，辐射压与引力精确抗衡。我们把这 100 亿年叫「现在」。' },
        { key: 'giant', R: 200, T: 3200, L: 2600, kind: 'giant', name: '红巨星', dur: '约 25 亿年', core: '氦 → 碳（氦闪）',
          note: '核心氢耗尽后，氢在壳层燃烧，把外层撑到原来的 200 倍。水星、金星会被吞掉，地球轨道也逼近它的表面。' },
        { key: 'shell', R: 1.5, T: 30000, L: 3000, kind: 'shell', name: '行星状星云', dur: '约 1 万年', core: '碳氧核心裸露',
          note: '外层被抛掉，露出炽热的碳氧核心。它的紫外光把气体壳点亮成发光的环——和行星无关，只是长得像。' },
        { key: 'wd', R: 0.013, T: 100000, L: 0.5, kind: 'wd', name: '白矮星', dur: '此后数百亿年慢慢冷却', core: '电子简并压',
          note: '地球大小，却有 0.6 个太阳质量。它不再聚变，只是把剩下的热量慢慢辐射进太空。' }
      ]
    },
    {
      id: 'massive', cn: '大质量恒星', en: 'Massive Star', mass: 15, massLabel: '15 M☉',
      color: '#9fd0ff', short: '大质量 · 以超新星收场',
      tagline: '活得快，死得烈。',
      desc: '质量越大，核心温度越高，聚变快得近乎挥霍。15 倍太阳质量的恒星只活 1,200 万年，却在此期间一层层点燃氢、氦、碳、氖、氧、硅，直到核心变成铁——铁无法再聚变放热，坍缩在不到一秒内发生。',
      stages: [
        { key: 'cloud', R: 1, T: 10, L: 0, kind: 'cloud', name: '分子云', dur: '约 1,000 万年', core: '—',
          note: '大质量恒星来得及在云里就点亮自己，往往还没离开诞生地就已经开始燃烧。' },
        { key: 'proto', R: 8, T: 25000, L: 5000, kind: 'proto', name: '原恒星', dur: '约 10 万年', core: '尚未点燃氢',
          note: '燃料消耗得越猛，收缩得越快。它只花十万年就走到主序。' },
        { key: 'ms', R: 5, T: 30000, L: 12000, kind: 'ms', name: '主序星', dur: '约 1,200 万年', core: '氢 → 氦（CNO 循环）',
          note: '核心温度高达 3,000 万度，氢靠 CNO 循环燃烧，效率是太阳的几十倍——代价是寿命短了几百倍。' },
        { key: 'giant', R: 1000, T: 3500, L: 200000, kind: 'giant', name: '红超巨星', dur: '约 50 万年', core: '逐层聚变到铁',
          note: '外层膨胀到 1,000 倍太阳半径，像洋葱一样一层层聚变，直到核心变成惰性铁。' },
        { key: 'sn', R: 3000, T: 1000000, L: 1e9, kind: 'sn', name: 'II 型超新星', dur: '峰值约数周', core: '铁核坍缩 → 中子星',
          note: '铁核在 0.1 秒内坍缩到 10 公里，外层撞上坚硬的中子核后被反弹出去。峰值光度能顶上一整个星系。' },
        { key: 'ns', R: 1.4e-5, T: 1000000, L: 0.0001, kind: 'ns', name: '中子星', dur: '脉冲星阶段约 1,000 万年', core: '中子简并压',
          note: '10 公里直径、1.4 倍太阳质量。磁极束扫过地球就是脉冲星——有的每秒能转 700 圈。' }
      ]
    },
    {
      id: 'huge', cn: '极大质量恒星', en: 'Very Massive Star', mass: 30, massLabel: '30 M☉',
      color: '#b8a6ff', short: '极大质量 · 直接坍缩成黑洞',
      tagline: '有些恒星的结局，连光都逃不掉。',
      desc: '超过 20 倍太阳质量的恒星，核心坍缩时释放的能量不足以把整颗星炸开。它可能经历一次暗淡的失败超新星，也可能直接塌进事件视界——只留下一个黑洞，和周围被点亮的气体。',
      stages: [
        { key: 'cloud', R: 1, T: 10, L: 0, kind: 'cloud', name: '分子云', dur: '约 1,000 万年', core: '—',
          note: '极大质量恒星稀少而短命，它们的光几乎全被星云的尘埃吸收再辐射出去。' },
        { key: 'proto', R: 10, T: 30000, L: 20000, kind: 'proto', name: '原恒星', dur: '约 5 万年', core: '尚未点燃氢',
          note: '辐射压已经强到接近alen，物质一边吸积一边被吹走，成长过程极其暴烈。' },
        { key: 'ms', R: 8, T: 42000, L: 800000, kind: 'ms', name: '主序星', dur: '约 600 万年', core: '氢 → 氦（CNO 循环）',
          note: '表面 4 万度，80 万倍太阳光度。它的星风强得能在周围吹出一个气泡。' },
        { key: 'giant', R: 1500, T: 3000, L: 1000000, kind: 'giant', name: '红超巨星 / LBV', dur: '约 30 万年', core: '逐层聚变到铁',
          note: '外层不稳定，会像沸腾一样连续抛掉几个太阳质量的物质——这是它死前最后的挣扎。' },
        { key: 'sn', R: 4000, T: 1000000, L: 2e9, kind: 'sn', name: '超新星 / 直接坍缩', dur: '数秒到数周', core: '铁核坍缩成黑洞',
          note: '核心坍缩时，中微子带走 99% 的能量。如果抛射失败，整颗星会直接消失成一个黑洞。' },
        { key: 'bh', R: 4.3e-5, T: 0, L: 0, kind: 'bh', name: '恒星级黑洞', dur: '霍金蒸发需 10⁶⁷ 年', core: '事件视界',
          note: '事件视界半径约 90 公里。它没有表面，也没有温度——只有质量、电荷和自转。' }
      ]
    }
  ];

  const TRACK_BY_ID = {};
  TRACKS.forEach(t => { TRACK_BY_ID[t.id] = t; });

  /* ---------- 光谱型 ---------- */
  function spectralType(T) {
    if (T >= 30000) return 'O';
    if (T >= 10000) return 'B';
    if (T >= 7500) return 'A';
    if (T >= 6000) return 'F';
    if (T >= 5200) return 'G';
    if (T >= 3700) return 'K';
    if (T >= 2400) return 'M';
    return 'L / T';
  }

  /* ============================================================
     GLSL
     ============================================================ */
  const NOISE_GLSL = `
    float hash31(vec3 p){ p = fract(p*0.3183099 + vec3(0.11,0.17,0.23)); p *= 17.0;
      return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vnoise(vec3 x){
      vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(hash31(i+vec3(0,0,0)), hash31(i+vec3(1,0,0)), f.x),
                     mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                     mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5;
      for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; } return s; }
  `;

  const STAR_VERT = `
    varying vec3 vPos; varying vec3 vN; varying vec3 vV;
    void main(){
      vPos = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const STAR_FRAG = `
    precision highp float;
    uniform vec3 uColor; uniform float uTime, uIntensity, uLimb, uGranule, uSpot;
    varying vec3 vPos; varying vec3 vN; varying vec3 vV;
    ${NOISE_GLSL}
    void main(){
      vec3 p = normalize(vPos);
      float n1 = fbm3(p*uGranule + vec3(0.0, uTime*0.045, 0.0));
      float n2 = fbm3(p*uGranule*3.3 - vec3(uTime*0.075, 0.0, uTime*0.03));
      float g = n1*0.62 + n2*0.38;
      float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
      float ld = 1.0 - uLimb*(1.0 - pow(mu, 0.55));
      float spot = smoothstep(0.70, 0.93, fbm3(p*2.6 + 7.31));
      vec3 col = uColor * (0.42 + 0.80*g) * ld * uIntensity;
      col *= 1.0 - uSpot*spot*0.7;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const ENV_FRAG = `
    precision highp float;
    uniform vec3 uColor; uniform float uOpacity, uTime, uGranule;
    varying vec3 vPos; varying vec3 vN; varying vec3 vV;
    ${NOISE_GLSL}
    void main(){
      float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
      float fres = pow(1.0 - mu, 2.2);
      float n = fbm3(normalize(vPos)*uGranule + vec3(0.0, uTime*0.03, 0.0));
      float a = fres * (0.55 + 0.6*n) * uOpacity;
      gl_FragColor = vec4(uColor * (0.7 + 0.5*n), a);
    }
  `;

  const RING_FRAG = `
    precision highp float;
    uniform float uInner, uOuter, uOpacity, uTime, uSpin;
    uniform vec3 uHot, uCool;
    varying vec3 vPos;
    ${NOISE_GLSL}
    void main(){
      float r = length(vPos.xy);
      float t = clamp((r - uInner) / max(0.0001, uOuter - uInner), 0.0, 1.0);
      float ang = atan(vPos.y, vPos.x);
      float swirl = fbm3(vec3(cos(ang-uTime*uSpin)*2.0, sin(ang-uTime*uSpin)*2.0, t*6.0));
      float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.5, 1.0, t));
      a *= 0.65 + 0.5*swirl;
      vec3 c = mix(uHot, uCool, pow(t, 0.65));
      gl_FragColor = vec4(c * (0.85 + 0.4*swirl), a*uOpacity);
    }
  `;

  function diskMaterial(inner, outer, hot, cool, opacity, spin) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uInner: { value: inner }, uOuter: { value: outer },
        uHot: { value: new THREE.Color(hot) }, uCool: { value: new THREE.Color(cool) },
        uOpacity: { value: opacity }, uTime: { value: 0 }, uSpin: { value: spin || 0.1 }
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: RING_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  /* ============================================================
     构建
     ============================================================ */
  function build(Core) {
    const scene = new THREE.Scene();
    const labels = [];
    const pickables = [];

    scene.add(C3D.makeSkyDome(3200));
    const stars = C3D.makeStarfield({ count: 11000, radius: 2600, seed: 909 });
    scene.add(stars);

    const root = new THREE.Group();
    scene.add(root);

    /* ---------- 恒星本体 ---------- */
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(1, 1, 1) },
        uTime: { value: 0 }, uIntensity: { value: 0.78 },
        uLimb: { value: 0.55 }, uGranule: { value: 3.4 }, uSpot: { value: 0.25 }
      },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG
    });
    const starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), starMat);
    starMesh.userData.pickId = 'sunlike';
    root.add(starMesh);
    pickables.push(starMesh);

    /* ---------- 外层包层（红巨星 / 超巨星） ---------- */
    const envMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xff9a6a) },
        uOpacity: { value: 0.0 }, uTime: { value: 0 }, uGranule: { value: 2.2 }
      },
      vertexShader: STAR_VERT, fragmentShader: ENV_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), envMat);
    envelope.scale.setScalar(1.5);
    envelope.visible = false;
    root.add(envelope);

    /* ---------- 光晕 ---------- */
    const glowTex = C3D.Tex.glow('rgba(255,255,255,0.95)', 'rgba(150,190,255,0.22)');
    const glowA = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      sizeAttenuation: false
    }));
    const glowB = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      sizeAttenuation: false
    }));
    root.add(glowA); root.add(glowB);

    /* ---------- 吸积盘（原恒星） ---------- */
    const diskMat = diskMaterial(1.35, 4.2, 0xfff0d0, 0xff7a3c, 0.85, 0.35);
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.35, 4.2, 128, 1), diskMat);
    disk.rotation.x = -Math.PI / 2;
    disk.visible = false;
    root.add(disk);

    /* ---------- 双极外流（原恒星） ---------- */
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    function cone(sign) {
      const g = new THREE.ConeGeometry(1.5, 7, 32, 1, true);
      const m = new THREE.Mesh(g, jetMat);
      m.position.y = sign * 3.6;
      if (sign < 0) m.rotation.z = Math.PI;
      m.visible = false;
      root.add(m);
      return m;
    }
    const jetA = cone(1), jetB = cone(-1);

    /* ---------- 行星状星云壳层 ---------- */
    const shellGroup = new THREE.Group();
    shellGroup.visible = false;
    root.add(shellGroup);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x66d9ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const shellRings = [];
    [[0, 0, 0, 5.2], [0.9, 0.5, 0.3, 4.4], [-0.7, 1.2, 0.6, 3.8]].forEach(cfg => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.0, 128, 1), shellMat.clone());
      m.rotation.set(cfg[0], cfg[1], cfg[2]);
      m.scale.setScalar(cfg[3]);
      m.material.opacity = 0.4;
      shellGroup.add(m);
      shellRings.push(m);
    });

    /* ---------- 超新星 ---------- */
    const snFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,255,255,1)', 'rgba(180,210,255,0.35)'),
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
    }));
    root.add(snFlash);
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.0, 160, 1),
      new THREE.MeshBasicMaterial({
        color: 0xbfe4ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    shock.visible = false;
    root.add(shock);

    const DEBRIS_N = 1400;
    const debrisGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(DEBRIS_N * 3);
    const rnd = C3D.noise.mulberry32(4242);
    for (let i = 0; i < DEBRIS_N; i++) {
      const u = rnd() * 2 - 1, th = rnd() * TAU, s = Math.sqrt(1 - u * u);
      const r = 0.55 + rnd() * 0.75;
      dPos[i * 3] = Math.cos(th) * s * r;
      dPos[i * 3 + 1] = u * r;
      dPos[i * 3 + 2] = Math.sin(th) * s * r;
    }
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    const debris = new THREE.Points(debrisGeo, new THREE.PointsMaterial({
      color: 0xffd9a8, size: 0.055, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    debris.visible = false;
    root.add(debris);

    /* ---------- 中子星辐射束 ---------- */
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xa8d8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const beamGroup = new THREE.Group();
    beamGroup.visible = false;
    root.add(beamGroup);
    [1, -1].forEach(s => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.34, 6, 24, 1, true), beamMat);
      m.position.y = s * 3.0;
      if (s < 0) m.rotation.z = Math.PI;
      beamGroup.add(m);
    });

    /* ---------- 恒星级黑洞 ---------- */
    const bhGroup = new THREE.Group();
    bhGroup.visible = false;
    root.add(bhGroup);
    const bhCore = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    bhCore.scale.setScalar(1.0);
    bhGroup.add(bhCore);
    const bhDiskMat = diskMaterial(1.6, 6.0, 0xffffff, 0xff8a3c, 0.9, 0.5);
    const bhDisk = new THREE.Mesh(new THREE.RingGeometry(1.6, 6.0, 160, 1), bhDiskMat);
    bhDisk.rotation.x = -Math.PI / 2 + 0.22;
    bhGroup.add(bhDisk);
    const photonRing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,240,210,0.95)', 'rgba(255,150,60,0.28)'),
      color: 0xffffff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    photonRing.scale.set(3.1, 1.1, 1);
    bhGroup.add(photonRing);
    const bhGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.glow('rgba(255,200,140,0.5)', 'rgba(255,110,40,0.12)'),
      color: 0xffffff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
    }));
    bhGlow.scale.set(16, 16, 1);
    bhGroup.add(bhGlow);

    /* ---------- 分子云 ---------- */
    const CLOUD_N = 2600;
    const cloudGeo = new THREE.BufferGeometry();
    const cPos = new Float32Array(CLOUD_N * 3);
    const cCol = new Float32Array(CLOUD_N * 3);
    const rnd2 = C3D.noise.mulberry32(31337);
    const col = new THREE.Color();
    for (let i = 0; i < CLOUD_N; i++) {
      const u = rnd2() * 2 - 1, th = rnd2() * TAU, s = Math.sqrt(1 - u * u);
      const r = Math.pow(rnd2(), 0.55);
      cPos[i * 3] = Math.cos(th) * s * r * 1.25;
      cPos[i * 3 + 1] = u * r * 0.62;
      cPos[i * 3 + 2] = Math.sin(th) * s * r;
      const warm = rnd2();
      col.setRGB(0.42 + warm * 0.35, 0.34 + warm * 0.22, 0.62 - warm * 0.18);
      cCol[i * 3] = col.r; cCol[i * 3 + 1] = col.g; cCol[i * 3 + 2] = col.b;
    }
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    cloudGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    const cloud = new THREE.Points(cloudGeo, new THREE.PointsMaterial({
      size: 0.035, vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    cloud.visible = false;

    const cloudGroup = new THREE.Group();
    cloudGroup.add(cloud);
    root.add(cloudGroup);

    const cloudSprites = [];
    [[0, 0, 0, 2.45, 0.42], [0.5, 0.21, -0.29, 1.6, 0.28], [-0.43, -0.14, 0.36, 1.3, 0.24]].forEach((c, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: C3D.Tex.nebula(i === 1 ? 205 : 268),
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      }));
      s.position.set(c[0], c[1], c[2]);
      s.scale.set(c[3], c[3], 1);
      s.visible = false;
      cloudGroup.add(s);
      cloudSprites.push({ spr: s, base: c[4] });
    });

    /* ============================================================
       状态
       ============================================================ */
    const state = {
      trackId: 'sunlike',
      progress: 0,          // 0..1
      playing: true,
      autoFrame: true,
      stageIndex: 0,
      lastStageKey: ''
    };

    let tClock = 0;
    let curR = 1, curT = 5772, curL = 1;
    let curDisp = 1.1;
    let starFrac = 0.4;   // 星体直径占视口高度的比例（屏幕空间光晕用）
    let curColor = new THREE.Color(1, 1, 1);

    /* ---------- 采样：把 progress 映射成连续的天体参数 ---------- */
    function sample(track, p) {
      const st = track.stages;
      const n = st.length;
      const f = clamp(p, 0, 1) * n;
      let i = Math.min(n - 1, Math.floor(f));
      if (i >= n - 1) { i = n - 1; }
      const frac = i >= n - 1 ? 0 : f - i;
      const a = st[i], b = st[Math.min(n - 1, i + 1)];
      const lg = (x, y, t) => Math.exp(lerp(Math.log(Math.max(x, 1e-8)), Math.log(Math.max(y, 1e-8)), t));
      return {
        i, next: Math.min(n - 1, i + 1), frac,
        R: lg(a.R, b.R, frac),
        T: lg(a.T, b.T, frac),
        L: lg(a.L, b.L, frac),
        // 混合 kind：前半段用 a，后半段用 b（视觉上在越过中点时切换形态）
        kind: frac < 0.5 ? a.kind : b.kind,
        a, b,
        dominant: frac < 0.5 ? a : b
      };
    }

    /* ---------- 标签重建 ---------- */
    function rebuildLabels(track, s) {
      labels.length = 0;
      const push = (text, pos, cls) => labels.push({
        id: track.id, text, cls: cls || '', maxDist: 400, pos
      });
      const k = s.kind;
      const v = (x, y, z) => () => new THREE.Vector3(x, y, z).multiplyScalar(Math.max(1, curDisp * 0.9));
      if (k === 'cloud') {
        push('分子云 · 10 K', () => new THREE.Vector3(0, curDisp * 1.6, 0), 'label-arm');
        push('尘埃与分子', () => new THREE.Vector3(curDisp * 1.1, -curDisp * 0.8, 0), 'label-arm');
      } else if (k === 'proto') {
        push('原恒星', () => new THREE.Vector3(0, curDisp * 1.15, 0));
        push('吸积盘', () => new THREE.Vector3(curDisp * 3.0, 0, 0), 'label-arm');
        push('双极外流', () => new THREE.Vector3(0, curDisp * 3.6, 0), 'label-arm');
      } else if (k === 'giant') {
        push('核心 · 壳层燃烧', () => new THREE.Vector3(0, 0, 0));
        push('膨胀包层', () => new THREE.Vector3(curDisp * 0.95, curDisp * 0.6, 0), 'label-arm');
      } else if (k === 'shell') {
        push('碳氧核心', () => new THREE.Vector3(0, 0, 0));
        push('行星状星云', () => new THREE.Vector3(curDisp * 4.6, 0, 0), 'label-arm');
      } else if (k === 'sn') {
        push('铁核坍缩', () => new THREE.Vector3(0, 0, 0));
        push('激波与抛射物', () => new THREE.Vector3(curDisp * 2.4, curDisp * 0.8, 0), 'label-arm');
      } else if (k === 'ns') {
        push('中子星 · 直径 10 km', () => new THREE.Vector3(0, curDisp * 1.2, 0));
        push('辐射束', () => new THREE.Vector3(0, curDisp * 5.2, 0), 'label-arm');
      } else if (k === 'bh') {
        push('事件视界', () => new THREE.Vector3(0, 0, 0));
        push('吸积盘', () => new THREE.Vector3(curDisp * 5.0, 0, 0), 'label-arm');
        push('光子环', () => new THREE.Vector3(0, curDisp * 1.4, 0), 'label-arm');
      } else if (k === 'wd') {
        push('白矮星 · 地球大小', () => new THREE.Vector3(0, curDisp * 1.5, 0));
        push('电子简并压支撑', () => new THREE.Vector3(curDisp * 1.4, -curDisp * 0.9, 0), 'label-arm');
      } else {
        push('核心 · 氢聚变', () => new THREE.Vector3(0, 0, 0));
        push('光球', () => new THREE.Vector3(curDisp * 0.92, curDisp * 0.5, 0), 'label-arm');
        push('日冕', () => new THREE.Vector3(curDisp * 1.9, curDisp * 1.1, 0), 'label-arm');
      }
      if (Core.active && Core.active.name === 'stellar') Core._syncLabels();
    }

    /* ---------- 每帧应用形态 ---------- */
    function applyVisual(s, dt, t) {
      const k = s.kind;
      const track = TRACK_BY_ID[state.trackId];
      curDisp = COMPACT_DISP[k] !== undefined ? COMPACT_DISP[k] : dispR(s.R);
      curColor = bbLinear(Math.max(1200, s.T));

      // 云 / 恒星 可见性
      const isCloud = k === 'cloud';
      starMesh.visible = !isCloud;
      glowA.visible = !isCloud; glowB.visible = !isCloud;
      cloud.visible = isCloud;
      cloudSprites.forEach(c => { c.spr.visible = isCloud; });

      if (isCloud) {
        cloud.rotation.y += dt * 0.02;
        const s2 = 1 + Math.sin(t * 0.5) * 0.012;
        cloud.scale.setScalar(s2);
        cloudGroup.scale.setScalar(curDisp * 1.75);
        cloudSprites.forEach((c, i) => {
          c.spr.material.opacity = c.base * (0.75 + 0.25 * Math.sin(t * 0.6 + i * 1.7));
        });
        return;
      }

      starMesh.scale.setScalar(curDisp);
      starMat.uniforms.uColor.value.copy(curColor);
      starMat.uniforms.uTime.value = tClock;
      // 越亮的星表面越"激烈"
      // 表面亮度由有效温度决定（∝T⁴ 的观感），不是总光度——红巨星虽然亮，表面却是冷的
      const lum = Math.log10(Math.max(s.L, 1e-6));
      const hot = clamp((Math.max(1200, s.T) - 2500) / 20000, 0, 1);
      starMat.uniforms.uIntensity.value = 0.36 + hot * 0.44;
      starMat.uniforms.uGranule.value = k === 'giant' ? 1.5 : 3.4;
      starMat.uniforms.uLimb.value = k === 'giant' ? 0.35 : 0.55;
      starMat.uniforms.uSpot.value = (track.id === 'sunlike' && k === 'ms') ? 0.28 : 0.1;

      // 光晕：以真光度（对数）驱动
      // 光晕是屏幕空间 sprite（sizeAttenuation=false，scale 1 ≈ 视口高度），
      // 所以按"星体在画面里的直径占比"给尺寸——推近拉远都自动贴合
      const camD = Math.max(0.001, Core.rig.radius);
      starFrac = Math.tan(Math.atan2(curDisp, camD)) / Math.tan(Core.camera.fov * Math.PI / 360);
      const gA = clamp(starFrac * (k === 'giant' ? 1.5 : 1.62), 0.16, 1.25);
      const gB = clamp(starFrac * (k === 'giant' ? 2.7 : 2.95), 0.26, 1.95);
      glowA.scale.set(gA, gA, 1);
      glowB.scale.set(gB, gB, 1);
      glowA.material.color.copy(curColor);
      glowB.material.color.copy(curColor);
      glowA.material.opacity = clamp(0.12 + hot * 0.17, 0.10, 0.27);
      glowB.material.opacity = clamp(0.022 + hot * 0.028, 0.018, 0.050);

      // 包层（红巨星 / 超巨星）
      const isGiant = k === 'giant';
      envelope.visible = isGiant;
      if (isGiant) {
        envelope.scale.setScalar(curDisp * (1.32 + Math.sin(t * 0.4) * 0.012));
        envMat.uniforms.uColor.value.copy(curColor);
        envMat.uniforms.uOpacity.value = 0.055;
        envMat.uniforms.uTime.value = tClock;
        envMat.uniforms.uGranule.value = 1.8;
      }

      // 原恒星盘 + 外流
      const isProto = k === 'proto';
      disk.visible = isProto;
      jetA.visible = isProto; jetB.visible = isProto;
      if (isProto) {
        disk.scale.setScalar(curDisp);
        diskMat.uniforms.uTime.value = tClock;
        diskMat.uniforms.uOpacity.value = 0.85;
        diskMat.uniforms.uHot.value.copy(curColor).lerp(new THREE.Color(0xffffff), 0.35);
        const js = curDisp * 0.55;
        jetA.scale.set(js, js * 1.2, js);
        jetB.scale.set(js, js * 1.2, js);
        jetA.position.y = curDisp * 2.6;
        jetB.position.y = -curDisp * 2.6;
        jetMat.opacity = 0.22 + 0.1 * Math.sin(t * 2.2);
      }

      // 行星状星云
      const isShell = k === 'shell';
      shellGroup.visible = isShell;
      if (isShell) {
        shellGroup.scale.setScalar(1);
        shellRings.forEach((m, i) => {
          const k2 = 1 + Math.sin(t * 0.6 + i * 2.1) * 0.05;
          const base = [5.2, 4.4, 3.8][i];
          m.scale.setScalar(base * k2 * clamp(curDisp / 0.6, 0.7, 1.4));
          m.material.opacity = 0.34 + 0.16 * Math.sin(t * 0.9 + i);
          m.rotation.z += dt * 0.05 * (i % 2 ? 1 : -1);
        });
      }

      // 超新星
      const isSN = k === 'sn';
      shock.visible = isSN; debris.visible = isSN;
      if (isSN) {
        const ph = (t * 0.55) % 1;
        shock.scale.setScalar(curDisp * (1.2 + ph * 5.5));
        shock.material.opacity = (1 - ph) * 0.55;
        debris.scale.setScalar(curDisp * (1.1 + ph * 3.2));
        debris.material.opacity = (1 - ph) * 0.7;
        debris.rotation.y += dt * 0.12;
        snFlash.scale.setScalar(clamp(starFrac * (5.2 + 2.2 * Math.sin(t * 7.0)), 0.6, 2.8));
        snFlash.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(t * 3.1));
        snFlash.visible = true;
        starMat.uniforms.uIntensity.value = 1.35;
      } else {
        snFlash.visible = false;
      }

      // 中子星
      const isNS = k === 'ns';
      beamGroup.visible = isNS;
      if (isNS) {
        const bs = curDisp * 0.9;
        beamGroup.scale.set(bs, bs, bs);
        beamGroup.rotation.y += dt * 2.4;
        beamMat.opacity = 0.25 + 0.2 * Math.abs(Math.sin(t * 3.0));
        glowA.material.opacity = 0.26 + 0.30 * Math.abs(Math.sin(t * 3.0));
      }

      // 黑洞
      const isBH = k === 'bh';
      bhGroup.visible = isBH;
      if (isBH) {
        const hs = Math.max(0.85, curDisp * 0.55);
        bhCore.scale.setScalar(hs);
        bhDisk.scale.setScalar(hs);
        bhDiskMat.uniforms.uTime.value = tClock;
        const bhFrac = Math.tan(Math.atan2(hs, Math.max(0.001, Core.rig.radius))) / Math.tan(Core.camera.fov * Math.PI / 360);
        photonRing.scale.set(clamp(bhFrac * 3.0, 0.22, 1.0), clamp(bhFrac * 2.3, 0.17, 0.8), 1);
        photonRing.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.6);
        bhGlow.scale.set(clamp(bhFrac * 5.4, 0.4, 1.9), clamp(bhFrac * 5.4, 0.4, 1.9), 1);
        bhGlow.material.opacity = 0.28 + 0.06 * Math.sin(t * 0.9);
        glowA.visible = false; glowB.visible = false;
        starMesh.visible = false;
      }
    }

    /* ---------- 自动取景 ---------- */
    function frameDistance() {
      // 每类天体一个取景倍数：黑洞要退得远到能看见整个吸积盘，
      // 中子星/白矮星要凑得近到能看见这个小球，否则就是一个小点
      const k = (state.lastStageKey || '').split('|')[0];
      let mul = 5.0, lo = 3.0;
      if (k === 'bh') { mul = 6.2; lo = 20; }
      else if (k === 'ns') { mul = 7.5; lo = 5.0; }
      else if (k === 'wd') { mul = 6.8; lo = 4.0; }
      else if (k === 'giant') { mul = 4.6; lo = 6.0; }
      return Math.max(lo, Math.min(460, curDisp * mul));
    }
    let autoFrameTarget = null;

    /* ---------- 标签位置函数需要 curDisp，闭包引用 ---------- */
    function rebuildIfStage(s) {
      const key = s.kind + '|' + state.trackId + '|' + s.i;
      if (key === state.lastStageKey) return false;
      state.lastStageKey = key;
      state.stageIndex = s.i;
      rebuildLabels(TRACK_BY_ID[state.trackId], s);
      return true;
    }

    /* ---------- 对外 API ---------- */
    const api = {
      name: 'stellar',
      scene, labels, pickables,
      near: 0.05, far: 9000,
      minRadius: 1.5, maxRadius: 900,
      bloom: 0.0, exposure: 1.0, bloomThreshold: 0.76,
      timeControl: false,
      selectedId: 'sunlike',
      state,
      tracks: TRACKS,
      getState: () => state,
      viewDistance: () => frameDistance(),
      debug() {
        const o = (m, extra) => m ? {
          s: +m.scale.x.toFixed(3), y: +m.position.y.toFixed(2),
          v: m.visible, o: m.material ? +m.material.opacity.toFixed(3) : null
        } : null;
        return {
          track: state.trackId, stage: state.stageIndex, kind: state.lastStageKey,
          d: +frameDistance().toFixed(2), curDisp: +curDisp.toFixed(3),
          star: o(starMesh), env: o(envelope), gA: o(glowA), gB: o(glowB),
          disk: o(disk), shell: o(shellGroup), bh: o(bhGroup), beam: o(beamGroup),
          cam: +Core.rig.radius.toFixed(2)
        };
      },

      enter() {
        const tr = TRACK_BY_ID[state.trackId];
        state.progress = 0;
        const s = sample(tr, 0);
        state.lastStageKey = '';
        rebuildIfStage(s);
        applyVisual(s, 0.016, 0);
        Core.rig.follow = null;
        Core.rig.snap(new THREE.Vector3(0, 0, 0), frameDistance(), 0.62, 1.12);
      },

      update(dt, t) {
        tClock += dt;
        const tr = TRACK_BY_ID[state.trackId];
        if (state.playing) {
          // 全程约 60 秒走完
          state.progress += dt / 60;
          if (state.progress >= 1) {
            state.progress = 1;
            state.playing = false;
          }
        }
        const s = sample(tr, state.progress);
        curR = s.R; curT = s.T; curL = s.L;
        const changed = rebuildIfStage(s);
        applyVisual(s, dt, t);

        if (changed && state.autoFrame) {
          const d = frameDistance();
          Core.rig.flyTo(new THREE.Vector3(0, 0, 0), d, { duration: 1.3, theta: 0.62, phi: 1.12 });
        }
      },

      setProgress(p) {
        state.progress = clamp(p, 0, 1);
        const tr = TRACK_BY_ID[state.trackId];
        const s = sample(tr, state.progress);
        rebuildIfStage(s);
        applyVisual(s, 0.016, tClock);
      },

      setTrack(id) {
        if (!TRACK_BY_ID[id]) return;
        state.trackId = id;
        state.progress = 0;
        state.playing = false;
        state.lastStageKey = '';
        api.selectedId = id;
        starMesh.userData.pickId = id;
        const tr = TRACK_BY_ID[id];
        const s = sample(tr, 0);
        rebuildIfStage(s);
        applyVisual(s, 0.016, tClock);
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), frameDistance(), { duration: 1.1, theta: 0.62, phi: 1.12 });
      },

      setPlaying(v) { state.playing = !!v; },
      togglePlay() {
        if (!state.playing && state.progress >= 0.999) state.progress = 0;
        state.playing = !state.playing;
        return state.playing;
      },

      focus(id) {
        const tr = TRACK_BY_ID[id] || TRACK_BY_ID[state.trackId];
        if (id && TRACK_BY_ID[id]) {
          if (state.trackId !== id) api.setTrack(id);
          return;
        }
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), frameDistance(), { duration: 1.2, theta: 0.62, phi: 1.12 });
      },

      reset() {
        state.progress = 0;
        state.playing = false;
        state.lastStageKey = '';
        const tr = TRACK_BY_ID[state.trackId];
        const s = sample(tr, 0);
        rebuildIfStage(s);
        applyVisual(s, 0.016, tClock);
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), frameDistance(), { duration: 1.2, theta: 0.62, phi: 1.12 });
      },

      /* 当前阶段的可读信息（给 info 面板） */
      info() {
        const tr = TRACK_BY_ID[state.trackId];
        const s = sample(tr, state.progress);
        const d = s.dominant;
        const trans = s.frac >= 0.5 && s.next !== s.i;
        const kindName = { cloud: '星云阶段', proto: '原恒星阶段', ms: '主序阶段', giant: '巨星阶段', shell: '抛射阶段', sn: '爆发阶段', ns: '致密残骸', wd: '致密残骸', bh: '致密残骸' }[d.kind] || '恒星阶段';
        const Rtxt = d.R >= 1 ? d.R.toFixed(d.R >= 100 ? 0 : 1) + ' R☉'
          : d.R >= 0.01 ? d.R.toFixed(3) + ' R☉'
            : d.R.toExponential(1) + ' R☉';
        const Ltxt = d.L === 0 ? '—'
          : d.L >= 1e4 ? d.L.toExponential(1) + ' L☉'
            : d.L >= 1 ? d.L.toFixed(0) + ' L☉'
              : d.L >= 0.001 ? d.L.toFixed(3) + ' L☉' : d.L.toExponential(1) + ' L☉';
        const Ttxt = d.T === 0 ? '—' : d.T >= 10000 ? d.T.toExponential(1) + ' K' : Math.round(d.T) + ' K';
        const compact = COMPACT_DISP[d.kind] !== undefined;
        const stats = [
          ['质量', tr.massLabel],
          ['半径', Rtxt],
          ['表面温度', Ttxt],
          ['光度', Ltxt],
          ['光谱型', d.T >= 2400 ? spectralType(d.T) : '—'],
          ['核心状态', d.core]
        ];
        return {
          id: tr.id,
          cn: d.name + (trans ? ' · 正在转变' : ''),
          en: tr.en + ' · ' + tr.massLabel,
          kind: kindName,
          color: bbHex(Math.max(1200, d.T)),
          tagline: d.note,
          stats,
          desc: tr.desc,
          facts: [
            '当前阶段持续：' + d.dur,
            compact ? '注意：致密天体的显示尺寸已被放大，否则你将完全看不见它。' : '显示半径为对数压缩，真实半径见上表。',
            '质量决定一切：' + tr.mass + ' 倍太阳质量的恒星，核心温度与寿命都由它锁定。'
          ]
        };
      },

      /* 赫罗图数据 */
      hrData() {
        const tr = TRACK_BY_ID[state.trackId];
        const s = sample(tr, state.progress);
        return {
          track: tr,
          stages: tr.stages.map((st, i) => ({ i, T: st.T, L: st.L, name: st.name, kind: st.kind })),
          cur: { T: Math.max(1200, s.T), L: Math.max(1e-6, s.L) },
          index: s.i,
          next: s.next,
          frac: s.frac
        };
      },

      dateLabel() { return ''; }
    };

    // 初始标签
    rebuildLabels(TRACK_BY_ID[state.trackId], sample(TRACK_BY_ID[state.trackId], 0));
    applyVisual(sample(TRACK_BY_ID[state.trackId], 0), 0.016, 0);

    return api;
  }

  C3D.buildStellar = build;
  C3D.STELLAR_TRACKS = TRACKS;
  C3D.STELLAR_TRACK_BY_ID = TRACK_BY_ID;
  C3D.STELLAR_UTIL = { bbColor, bbHex, dispR };
})();