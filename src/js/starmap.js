/* =========================================================================
 * 星空 —— 真实全天恒星 / 星座 / 银河
 * 站在地球上看出去的天球：所有恒星按 J2000 赤道坐标铺在半径 900 的球面上，
 * 视角靠相机自转（rig 半径恒为 0.02），视场靠 FOV（12°–70°）缩放。
 * 数据来源：d3-celestial stars.6.json（依巴谷/BSM 星表）+ constellations.lines.json
 * ========================================================================= */
(function () {
  const DEG = Math.PI / 180;
  const R = 900;            // 天球半径
  const TAU = Math.PI * 2;

  /* ---------- 坐标工具 ---------- */
  // 赤经赤纬 → 单位向量。约定：赤经 0h 在 -Z，赤经增加时向左（-X 方向）看。
  function eqv(raDeg, decDeg, r) {
    const ra = raDeg * DEG, dec = decDeg * DEG, cd = Math.cos(dec);
    return { x: r * cd * Math.cos(ra), y: r * Math.sin(dec), z: -r * cd * Math.sin(ra) };
  }
  function vecToEq(v) {
    const r = Math.hypot(v.x, v.y, v.z) || 1;
    let ra = Math.atan2(-v.z, v.x) / DEG; if (ra < 0) ra += 360;
    return [ra, Math.asin(Math.max(-1, Math.min(1, v.y / r))) / DEG];
  }
  // 银道 → 赤道（J2000 旋转矩阵的转置）
  const GAL = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.4448296300, 0.7469822445],
    [-0.8676661490, -0.1980763734, 0.4559837762]
  ];
  function galToEq(lDeg, bDeg) {
    const l = lDeg * DEG, b = bDeg * DEG, cb = Math.cos(b);
    const gx = cb * Math.cos(l), gy = cb * Math.sin(l), gz = Math.sin(b);
    return vecToEq({
      x: GAL[0][0] * gx + GAL[1][0] * gy + GAL[2][0] * gz,
      y: GAL[0][1] * gx + GAL[1][1] * gy + GAL[2][1] * gz,
      z: GAL[0][2] * gx + GAL[1][2] * gy + GAL[2][2] * gz
    });
  }

  /* ---------- 颜色 ---------- */
  // 色指数 B-V → RGB（近似黑体色）
  function bvColor(bv) {
    const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    let r, g, b;
    if (T <= 6600) { r = 1; g = Math.max(0, Math.min(1, 0.30 * Math.log(T / 1000) + 0.55)); b = Math.max(0, Math.min(1, 0.98 * Math.log(T / 1000) - 1.02)); }
    else { r = Math.max(0, Math.min(1, 1.29 * Math.pow((T - 6600) / 10000, -1 / 3) - 0.13)); g = Math.max(0, Math.min(1, 1.13 * Math.pow((T - 6600) / 10000, -1 / 3) - 0.13)); b = 1; }
    return [r, g, b];
  }
  // Ballesteros 公式：B-V → 表面温度（K）
  function bvTemp(bv) { return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); }

  /* ---------- 着色器 ---------- */
  const STAR_VERT = `
    attribute float aSize;
    attribute float aMag;
    attribute vec3 aColor;
    uniform float uScale;
    uniform float uLimit;
    uniform float uBoost;
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vColor = aColor;
      // 星等每 +1 等亮度约减到 0.4 倍；直径按 flux 的平方根缩
      float vis = clamp((uLimit - aMag) / 1.35, 0.0, 1.0);
      vAlpha = vis * uBoost;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uScale;
    }
  `;
  const STAR_FRAG = `
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      float r = length(gl_PointCoord - vec2(0.5));
      if (r > 0.5) discard;
      float a = pow(1.0 - r * 2.0, 1.25);
      gl_FragColor = vec4(vColor * a, a * vAlpha);
    }
  `;
  const MW_VERT = `
    attribute float aSize;
    attribute vec3 aColor;
    uniform float uScale;
    varying vec3 vColor;
    varying float vA;
    void main(){
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uScale;
      vA = 1.0;
    }
  `;
  const MW_FRAG = `
    varying vec3 vColor;
    varying float vA;
    uniform float uOpacity;
    void main(){
      float r = length(gl_PointCoord - vec2(0.5));
      if (r > 0.5) discard;
      float a = pow(1.0 - r * 2.0, 2.2) * uOpacity;
      gl_FragColor = vec4(vColor, a);
    }
  `;

  /* ---------- 星座一句话 ---------- */
  const STARMAP_CONS = {
    ori: { abbr: 'Ori', name: '猎户座', en: 'Orion', star: '参宿四', mag: '0.45', season: '冬季 · 1 月',
      one: '全天最好认的星座：三颗腰带星一字排开，左上橙红的是参宿四，右下青白的是参宿七。',
      fact: '腰带星之一「参宿三」几乎正对天赤道，所以猎户座在南北半球都能看到。' },
    cma: { abbr: 'CMa', name: '大犬座', en: 'Canis Major', star: '天狼', mag: '−1.44', season: '冬季 · 1 月',
      one: '天狼是全天最亮的恒星，只需 8.6 光年，是夜空里最容易找到的亮星。',
      fact: '天狼其实是一对：天狼 A 加一颗白矮星天狼 B，两者绕转周期 50 年。' },
    gem: { abbr: 'Gem', name: '双子座', en: 'Gemini', star: '北河三', mag: '1.16', season: '冬季 · 2 月',
      one: '两颗亮星「北河二」「北河三」并排，像两个并肩的人；北河三橙黄，北河二青白。',
      fact: '北河二是一对食双星，亮度每 21 天变化一次，是第一个被发现的爱丁顿极限验证系统。' },
    tau: { abbr: 'Tau', name: '金牛座', en: 'Taurus', star: '毕宿五', mag: '0.87', season: '冬季 · 1 月',
      one: '毕星团组成的 V 形是牛脸，红色毕宿五是牛眼；再往东两颗星是牛角。',
      fact: '牛角尖附近的蟹状星云，是公元 1054 年中国宋代记录的那颗超新星留下的遗迹。' },
    uma: { abbr: 'UMa', name: '大熊座', en: 'Big Dipper', star: '天枢', mag: '1.81', season: '春季 · 4 月',
      one: '北斗七星：把斗口的天璇到天枢连一条线，再朝斗外延长 5 倍，就撞到北极星。',
      fact: '北斗七星的中间五颗其实是同一片星际云里诞生的兄弟星，正以相似速度一起前进。' },
    leo: { abbr: 'Leo', name: '狮子座', en: 'Leo', star: '轩辕十四', mag: '1.36', season: '春季 · 4 月',
      one: '「反向问号」是狮子的头鬃，后面那个三角是狮子的后腿和尾巴。',
      fact: '轩辕十四几乎正好在黄道上，所以月亮和行星经常从它身边经过，古代用它标记季节。' },
    cyg: { abbr: 'Cyg', name: '天鹅座', en: 'Cygnus', star: '天津四', mag: '1.25', season: '夏季 · 8 月',
      one: '一支大「十」字划过银河，又叫「北十字」；天津四、天津一、天津三组成夏季大三角之一角。',
      fact: '天鹅座 X-1 是人类确认的第一个恒星级黑洞，质量约太阳的 21 倍。' },
    lyr: { abbr: 'Lyr', name: '天琴座', en: 'Lyra', star: '织女一', mag: '0.03', season: '夏季 · 8 月',
      one: '织女一是夏夜头顶最亮的星，旁边四个小星组成的小平行四边形就是「织女的梭子」。',
      fact: '织女星是第一颗被拍下光谱、也是第一颗被直接测到直径的恒星，它只有 4 亿岁。' },
    aql: { abbr: 'Aql', name: '天鹰座', en: 'Aquila', star: '河鼓二', mag: '0.76', season: '夏季 · 8 月',
      one: '河鼓二就是牛郎星，银河东岸最亮的一颗；它两侧各有一颗小星，是牛郎挑着的两个孩子。',
      fact: '牛郎星距离我们 16.7 光年，它是人类第一次用射电望远镜测出「自转扁圆」的恒星。' },
    sco: { abbr: 'Sco', name: '天蝎座', en: 'Scorpius', star: '心宿二', mag: '1.06', season: '夏季 · 7 月',
      one: '像一支巨大的钩子：红色的心宿二是蝎心，往下弯成一串是蝎尾。',
      fact: '心宿二是红超巨星，直径约太阳的 700 倍；如果放在太阳位置，能吞到火星轨道。' },
    and: { abbr: 'And', name: '仙女座', en: 'Andromeda', star: '壁宿二', mag: '2.07', season: '秋季 · 10 月',
      one: '从壁宿二往北找到 β 星，再往上一档，就能看到一小团雾状光——仙女座大星系。',
      fact: 'M31 距离我们 254 万光年，是肉眼可见的最远天体；它正以每秒 110 公里靠近银河系。' },
    cas: { abbr: 'Cas', name: '仙后座', en: 'Cassiopeia', star: '策', mag: '2.15', season: '秋季 · 11 月',
      one: '五颗亮星组成一个横着的「W」，和北斗七星隔着北极星遥遥相对，整夜不落。',
      fact: '仙后座 A 是银河系内已知最年轻的超新星遗迹之一，在地球上用肉眼曾经亮到过 6 等。' },
    cru: { abbr: 'Cru', name: '南十字座', en: 'Crux', star: '马腹一', mag: '0.61', season: '南半球 · 5 月',
      one: '全天最小的星座，十字架长轴指向南天极——南半球的「北极星」就在那条线上。',
      fact: '十字架二（α Cru）距离 321 光年，是已知最亮的「蓝色大星」之一，肉眼看去几乎是一个点。' }
  };
  const CONS_ORDER = ['ori', 'cma', 'gem', 'tau', 'uma', 'leo', 'cyg', 'lyr', 'aql', 'sco', 'and', 'cas', 'cru'];

  /* ---------- 构建场景 ---------- */
  function build(Core) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02030a);
    const root = new THREE.Group();   // 整个天球（观测模式下整体旋转到此刻此地）
    scene.add(root);
    const labels = [], pickables = [];
    const state = {
      lp: 2, fov: 52, tFov: 52, showLines: true, selCons: null, selStar: -1,
      centerCons: 'ori', tTheta: 0, tPhi: 0, tR: 0, tD: 0, dRa: 0, dDec: 0
    };
    let starPts, mwPts, starMat, mwMat, lineGroup;
    const wv = v => (state.obs ? v.clone().applyQuaternion(root.quaternion) : v);
    const consObjs = {};
    let t = 0;

    /* --- 恒星 --- */
    const S = C3D.SKY_STARS;
    const n = S.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const siz = new Float32Array(n), mag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = S[i];
      const v = eqv(s[0], s[1], R);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const c = bvColor(s[3]);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      mag[i] = s[2];
      // 直径：每等 0.4 倍流量 → 取 10^(-0.2*(m+1)) 归一到合理像素
      siz[i] = Math.max(2.3, 3.3 * Math.pow(10, -0.22 * (s[2] - 0.5)));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    sg.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    starMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uLimit: { value: 6.5 }, uBoost: { value: 1.55 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    starPts = new THREE.Points(sg, starMat);
    starPts.frustumCulled = false;
    starPts.userData.pickKind = 'stars';
    root.add(starPts);
    pickables.push(starPts);

    /* --- 银河 --- */
    (function buildMW() {
      const N = 90000;
      const mp = new Float32Array(N * 3), mc = new Float32Array(N * 3), ms = new Float32Array(N);
      let seed = 20240517;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.7;
      for (let i = 0; i < N; i++) {
        const l = rnd() * 360;
        // 银河有薄盘与厚盘两层，再留少量高银纬的「星晕」
        let b;
        if (rnd() < 0.82) b = gauss() * 4.2;
        else if (rnd() < 0.90) b = gauss() * 13;
        else b = (rnd() - 0.5) * 180;
        const eq = galToEq(l, b);
        const v = eqv(eq[0], eq[1], R * 0.995);
        mp[i * 3] = v.x; mp[i * 3 + 1] = v.y; mp[i * 3 + 2] = v.z;
        // 银心方向更黄更亮
        const toC = Math.max(0, Math.cos((l - 0) * DEG));
        const warm = Math.pow(toC, 4);
        const fade = Math.exp(-Math.abs(b) / 7);
        const br = (0.42 + 1.15 * fade) * (0.55 + 0.80 * warm) * (0.6 + 0.6 * rnd());
        mc[i * 3] = br * (1.0 + 0.10 * warm);
        mc[i * 3 + 1] = br * (0.95 + 0.05 * warm);
        mc[i * 3 + 2] = br * (1.05 - 0.18 * warm);
        ms[i] = 2.5 + rnd() * 2.4 + (1 - fade) * 2.2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(mp, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(mc, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
      mwMat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uOpacity: { value: 0.78 } },
        vertexShader: MW_VERT, fragmentShader: MW_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      mwPts = new THREE.Points(g, mwMat);
      mwPts.frustumCulled = false;
      root.add(mwPts);
    })();

    /* --- 银河光带：整片柔光，点云只作纹理 --- */
    let bandMat = null;
    (function buildBand() {
      const galN = eqv(192.859, 27.128, 1);   // 银河北极（J2000）
      const galC = eqv(266.405, -28.936, 1);  // 银心方向
      const VERT = `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const FRAG = `
        varying vec3 vDir;
        uniform vec3 uN;
        uniform vec3 uC;
        uniform float uOpacity;

        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float noise(vec3 p){
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n000 = hash(i), n100 = hash(i + vec3(1,0,0));
          float n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
          float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1));
          float n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
          return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
                     mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
        }
        float fbm(vec3 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }
        void main(){
          vec3 d = normalize(vDir);
          float b = asin(clamp(dot(d, uN), -1.0, 1.0));
          float core = pow(max(0.0, dot(d, uC)), 2.2);
          float band = exp(-pow(b / 0.105, 2.0));
          float wide = exp(-pow(b / 0.40, 2.0)) * 0.085;
          float n = fbm(d * 6.5);
          float dust = 1.0 - 0.60 * exp(-pow(b / 0.032, 2.0)) * (0.35 + 0.65 * n);
          vec3 col = mix(vec3(0.50, 0.60, 0.88), vec3(1.00, 0.84, 0.62), core);
          float a = (band * 0.26 + wide) * (0.40 + 0.85 * n) * dust * uOpacity;
          gl_FragColor = vec4(col * a, a);
        }
      `;
      bandMat = new THREE.ShaderMaterial({
        uniforms: { uN: { value: galN }, uC: { value: galC }, uOpacity: { value: 0.62 } },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide
      });
      const g = new THREE.SphereGeometry(R * 0.985, 64, 40);
      const mesh = new THREE.Mesh(g, bandMat);
      mesh.frustumCulled = false;
      mesh.userData.noPick = true;
      root.add(mesh);
    })();

    /* --- 星座连线（每条星座一个 LineSegments，便于点击识别） --- */
    lineGroup = new THREE.Group();
    const LN = C3D.SKY_LINES;
    const CON = C3D.SKY_CONS;
    for (let li = 0; li < LN.length; li++) {
      const abbr = LN[li][0], pts = LN[li][1];
      const arr = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = eqv(pts[i][0], pts[i][1], R * 0.99);
        const b = eqv(pts[i + 1][0], pts[i + 1][1], R * 0.99);
        arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      if (!arr.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const m = new THREE.LineBasicMaterial({
        color: 0x9cc6ff, transparent: true, opacity: 0.52,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const obj = new THREE.LineSegments(g, m);
      obj.frustumCulled = false;
      obj.userData.pickKind = 'cons';
      obj.userData.abbr = abbr;
      obj.userData.pickId = abbr;
      lineGroup.add(obj);
      consObjs[abbr] = obj;
      pickables.push(obj);
    }
    root.add(lineGroup);

    /* --- 星座标签（只给有 rail 条目的） --- */
    const labelDefs = CONS_ORDER.map(k => {
      const c = CON[STARMAP_CONS[k].abbr];
      return { k, c };
    }).filter(o => o.c);
    labelDefs.forEach(o => {
      const v = eqv(o.c.c[0], o.c.c[1], R * 0.94);
      const p = new THREE.Vector3(v.x, v.y, v.z);
      labels.push({
        id: o.k, text: o.c.zh, cls: 'sky-label',
        pos: () => (state.showLines ? wv(p) : null),
        maxDist: 1e9
      });
    });

    /* --- 亮星名标签：只在放大（fov ≤ 30°）时出现，避免满屏文字 --- */
    const STAR_NAMES = ['天狼','老人','大角','南门二','织女一','五车二','参宿七','南河三','参宿四',
      '马腹一','河鼓二','毕宿五','心宿二','角宿一','北河三','北落师门','天津四','轩辕十四','勾陈一','北极星'];
    const seen = new Set();
    for (const nm of STAR_NAMES) {
      const i = S.findIndex(x => x[4] === nm);
      if (i < 0 || seen.has(nm)) continue;
      seen.add(nm);
      const v = eqv(S[i][0], S[i][1], R * 0.965);
      const pv = new THREE.Vector3(v.x, v.y, v.z);
      labels.push({
        id: 'star:' + i, text: nm, cls: 'sky-label star-label',
        pos: () => (state.fov <= 30 ? wv(pv) : null),
        maxDist: 1e9
      });
    }

    /* --- 选中的星座在画面中标记 --- */
    const ringGeo = new THREE.RingGeometry(0.985, 1.0, 64);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0x8fd0ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    ring.visible = false;
    root.add(ring);
    /* ================= 观测模式：把整片天球转到「此刻此地」 ================= */
    const SITES = [
      { cn: '北京', lat: 39.9042, lon: 116.4074 }, { cn: '上海', lat: 31.2304, lon: 121.4737 },
      { cn: '广州', lat: 23.1291, lon: 113.2644 }, { cn: '成都', lat: 30.5728, lon: 104.0668 },
      { cn: '西安', lat: 34.3416, lon: 108.9398 }, { cn: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
      { cn: '拉萨', lat: 29.6520, lon: 91.1721 }, { cn: '哈尔滨', lat: 45.8038, lon: 126.5349 },
      { cn: '台北', lat: 25.0330, lon: 121.5654 }, { cn: '香港', lat: 22.3193, lon: 114.1694 },
      { cn: '东京', lat: 35.6762, lon: 139.6503 }, { cn: '伦敦', lat: 51.5074, lon: -0.1278 },
      { cn: '纽约', lat: 40.7128, lon: -74.0060 }, { cn: '悉尼', lat: -33.8688, lon: 151.2093 }
    ];
    const BODIES = [
      // 真实角直径只有几角秒到半度，屏幕上不足 1 px；为了看得见统一放大（画面上会标注）
      { key: 'Sun', cn: '太阳', color: 0xffd39a, size: 9.0, glow: 40 },
      { key: 'Moon', cn: '月亮', color: 0xdfe6f2, size: 9.0, glow: 15 },
      { key: 'Mercury', cn: '水星', color: 0xd6c6a6, size: 3.6, glow: 10 },
      { key: 'Venus', cn: '金星', color: 0xfff4d2, size: 5.2, glow: 17 },
      { key: 'Mars', cn: '火星', color: 0xff8a5c, size: 4.4, glow: 12 },
      { key: 'Jupiter', cn: '木星', color: 0xffe2b4, size: 5.8, glow: 18 },
      { key: 'Saturn', cn: '土星', color: 0xffeab8, size: 5.2, glow: 15 }
    ];
    state.obs = false;
    state.obsDate = new Date();
    state.siteIdx = 0;

    const obsGroup = new THREE.Group();
    obsGroup.visible = false;
    root.add(obsGroup);
    const bodies = {};
    BODIES.forEach(b => {
      const g = new THREE.Group();
      const isMoon = b.key === 'Moon';
      // 月亮用自写着色器算晨昏线（太阳方向来自真实位置），其余天体直接自发光
      const mat = isMoon
        ? new THREE.ShaderMaterial({
            uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: new THREE.Color(0xdfe6f2) } },
            vertexShader: [
              'varying vec3 vN;',
              'void main() {',
              '  vN = normalize(mat3(modelMatrix) * normal);',
              '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
              '}'
            ].join('\n'),
            fragmentShader: [
              'uniform vec3 uSun;',
              'uniform vec3 uColor;',
              'varying vec3 vN;',
              'void main() {',
              '  float d = dot(normalize(vN), normalize(uSun));',
              '  float lit = smoothstep(-0.05, 0.07, d);',
              '  gl_FragColor = vec4(uColor * (0.06 + 0.94 * lit), 1.0);',
              '}'
            ].join('\n')
          })
        : new THREE.MeshBasicMaterial({ color: b.color });
      const core = new THREE.Mesh(new THREE.SphereGeometry(b.size, isMoon ? 28 : 14, isMoon ? 20 : 10), mat);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: C3D.Tex.dot(), color: b.color, transparent: true, opacity: isMoon ? 0.20 : 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      }));
      halo.scale.setScalar(b.glow);
      g.add(core); g.add(halo);
      obsGroup.add(g);
      bodies[b.key] = { def: b, group: g, core, halo };
      const pv = new THREE.Vector3();
      labels.push({
        id: 'body:' + b.key, text: b.cn, cls: 'sky-label body-label',
        pos: () => (state.obs && g.visible ? pv.copy(g.position).applyQuaternion(root.quaternion) : null),
        maxDist: 1e9
      });
    });

    const obsLight = new THREE.DirectionalLight(0xfff2dd, 2.6);
    obsLight.visible = false;
    scene.add(obsLight);
    const obsAmb = new THREE.AmbientLight(0x1a2338, 0.9);
    scene.add(obsAmb);

    /* --- 地平线与地面 --- */
    const horizonGroup = new THREE.Group();
    horizonGroup.visible = false;
    scene.add(horizonGroup);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R * 1.6, 96),
      new THREE.MeshBasicMaterial({ color: 0x04060b, side: THREE.DoubleSide }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.1;
    horizonGroup.add(ground);
    const hring = new THREE.Mesh(new THREE.RingGeometry(R * 1.16, R * 1.175, 180),
      new THREE.MeshBasicMaterial({ color: 0x5c80b8, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    hring.rotation.x = -Math.PI / 2;
    horizonGroup.add(hring);
    [['北', 0], ['东', 90], ['南', 180], ['西', 270]].forEach(d => {
      const a = d[1] * DEG;
      const p = new THREE.Vector3(Math.sin(a) * R * 1.10, 2.0, -Math.cos(a) * R * 1.10);
      labels.push({ id: 'dir:' + d[0], text: d[0], cls: 'sky-label compass', pos: () => (state.obs ? p : null), maxDist: 1e9 });
    });

    let lastObs = null;
    function applyObs() {
      const on = state.obs && typeof Astronomy !== 'undefined';
      horizonGroup.visible = on;
      obsGroup.visible = on;
      obsLight.visible = on;
      if (!on) {
        root.quaternion.identity();
        starMat.uniforms.uBoost.value = 1.55;
        scene.background.setHex(0x02030a);
        setLightPollution(state.lp);
        lastObs = null;
        return null;
      }
      const site = SITES[state.siteIdx];
      const d = state.obsDate;
      // 地方恒星时 = 格林尼治恒星时 + 经度（小时）
      const lst = (((Astronomy.SiderealTime(d) + site.lon / 15) % 24) + 24) % 24 * 15;
      // 赤道坐标（x=α0, y=北天极, z=−α6h，左手系）→ 地平坐标（x=东, y=天顶, z=−北）
      const cl = Math.cos(site.lat * DEG), sl = Math.sin(site.lat * DEG);
      const cs = Math.cos(lst * DEG), ss = Math.sin(lst * DEG);
      const m = new THREE.Matrix4().set(
        -ss, 0, -cs, 0,
        cl * cs, sl, -cl * ss, 0,
        sl * cs, -cl, -sl * ss, 0,
        0, 0, 0, 1
      );
      root.quaternion.setFromRotationMatrix(m);

      const observer = new Astronomy.Observer(site.lat, site.lon, 0);
      let above = 0, sunAlt = -90, moonPhase = 0, moonAlt = -90;
      const sunDir = new THREE.Vector3(0, 1, 0);
      const rows = [];
      BODIES.forEach(b => {
        const o = bodies[b.key];
        const eq = Astronomy.Equator(Astronomy.Body[b.key], d, observer, true, true);
        const v = eqv(eq.ra * 15, eq.dec, R * 0.975);
        o.group.position.set(v.x, v.y, v.z);
        o.group.visible = true;
        const hor = Astronomy.Horizon(d, observer, eq.ra, eq.dec, 'normal');
        if (hor.altitude > 0) above++;
        if (b.key === 'Sun') { sunAlt = hor.altitude; sunDir.copy(v).normalize(); }
        if (b.key === 'Moon') {
          moonAlt = hor.altitude;
          moonPhase = Astronomy.Illumination(Astronomy.Body.Moon, d).phase_fraction;
        }
        rows.push({ key: b.key, cn: b.cn, alt: hor.altitude, az: hor.azimuth, mag: null });
      });
      obsLight.position.copy(sunDir).multiplyScalar(700);
      // 太阳一出来，星星就被天光淹没 —— 这正是「白天看不见星星」的原因
      const day = Math.max(0, Math.min(1, (sunAlt + 6) / 14));
      starMat.uniforms.uBoost.value = 1.55 - day * 1.42;
      // 观测模式下点云只当底纹：90k 点在 52° 视场里会叠成一块过曝亮斑
      if (bodies.Moon) {
        const sw = bodies.Sun.group.position.clone().applyQuaternion(root.quaternion);
        const mw = bodies.Moon.group.position.clone().applyQuaternion(root.quaternion);
        bodies.Moon.core.material.uniforms.uSun.value.copy(sw.sub(mw).normalize());
      }
      mwMat.uniforms.uOpacity.value = (0.78 - state.lp * 0.155) * (1 - day * 0.94) * 0.30;
      if (bandMat) bandMat.uniforms.uOpacity.value = Math.max(0, (0.62 - state.lp * 0.125) * (1 - day * 0.96));
      // 天光：太阳越高，天空越蓝越亮（真实现场：正午天蓝、日落橙红过渡）
      const nightB = new THREE.Color(0x02030a);
      const duskB = new THREE.Color(0x123055);
      const noonB = new THREE.Color(0x6f9fd0);
      if (day < 0.5) scene.background.copy(nightB).lerp(duskB, day * 2);
      else scene.background.copy(duskB).lerp(noonB, (day - 0.5) * 2);
      lastObs = { lst, above, sunAlt, moonAlt, moonPhase, moonAngle: Astronomy.MoonPhase(d), site, rows, date: d };
      return lastObs;
    }

    function setObs(on) { state.obs = !!on; return applyObs(); }
    function setObsDate(ms) { state.obsDate = new Date(ms); return applyObs(); }
    function setSite(i) { state.siteIdx = Math.max(0, Math.min(SITES.length - 1, i | 0)); return applyObs(); }


    /* --- 滚轮调视场 / 点击选星 --- */
    (function bindSky() {
      const cv = Core.renderer.domElement;
      cv.addEventListener('wheel', e => {
        if (Core.activeName !== 'starmap') return;
        e.preventDefault();
        const k = Math.sign(e.deltaY) || 1;
        setFov(state.tFov * (k > 0 ? 1.14 : 1 / 1.14));
      }, { passive: false });

      const ray = new THREE.Raycaster();
      ray.params.Points.threshold = R * 0.012;
      const m = new THREE.Vector2();
      let sx = 0, sy = 0;
      cv.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
      cv.addEventListener('pointerup', e => {
        if (Core.activeName !== 'starmap') return;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) return;
        const rect = cv.getBoundingClientRect();
        m.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        m.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(m, Core.camera);
        const hits = ray.intersectObject(starPts, false);
        if (hits.length && hits[0].index !== undefined) {
          state.selStar = hits[0].index;
          state.selCons = null;
          const p = api.starPanel(hits[0].index);
          if (p && C3D.UI) { C3D.UI.selected = null; C3D.UI.showPanel(p); }
        }
      });
    })();

    /* --- API --- */
    function centerOf(k) {
      const cs = STARMAP_CONS[k];
      if (!cs) return null;
      const c = CON[cs.abbr];
      return c ? c.c : null;
    }

    function setLightPollution(lp) {
      state.lp = Math.max(0, Math.min(5, lp));
      // 光污染越强，能看到的最暗星等越亮；银河被冲掉
      const lim = 6.6 - state.lp * 0.95;
      starMat.uniforms.uLimit.value = lim;
      mwMat.uniforms.uOpacity.value = Math.max(0.02, 0.78 - state.lp * 0.155);
      if (bandMat) bandMat.uniforms.uOpacity.value = Math.max(0.0, 0.62 - state.lp * 0.125);
      return lim;
    }

    function setFov(f) {
      state.tFov = Math.max(12, Math.min(72, f));
    }

    // 把赤经赤纬转成 rig 的 θ/φ（rig 相机在球心看向外）
    function anglesFor(ra, dec) {
      const phi = Math.PI / 2 + dec * DEG;
      const th = Math.atan2(-Math.cos(ra * DEG), Math.sin(ra * DEG));
      return { theta: th, phi: Math.max(0.06, Math.min(Math.PI - 0.06, phi)) };
    }

    function goToRaDec(ra, dec, instant) {
      const a = anglesFor(ra, dec);
      const rig = Core.rig;
      // 选最近的等价角，避免绕远路
      let th = a.theta;
      while (th - rig.theta > Math.PI) th -= TAU;
      while (th - rig.theta < -Math.PI) th += TAU;
      if (instant) { rig.snap(new THREE.Vector3(0, 0, 0), 0.02, th, a.phi); rig.tTheta = th; rig.tPhi = a.phi; }
      else { rig.tTheta = th; rig.tPhi = a.phi; rig.fly = null; }
      state.selCons = null; state.selStar = -1;
    }

    // 选中星座时提亮它的连线、压暗其余，避免满屏线稿
    function highlightCons(k) {
      const target = k && STARMAP_CONS[k] ? STARMAP_CONS[k].abbr : null;
      for (const ab in consObjs) {
        const m = consObjs[ab].material;
        m.opacity = target ? (ab === target ? 0.95 : 0.13) : 0.52;
        m.color.setHex(ab === target ? 0xcfe2ff : 0x9cc6ff);
      }
    }

    function goToCons(k, instant) {
      const c = centerOf(k);
      if (!c) return;
      const cs = STARMAP_CONS[k];
      state.selCons = k; state.selStar = -1;
      const a = anglesFor(c[0], c[1]);
      const rig = Core.rig;
      let th = a.theta;
      while (th - rig.theta > Math.PI) th -= TAU;
      while (th - rig.theta < -Math.PI) th += TAU;
      if (instant) { rig.snap(new THREE.Vector3(0, 0, 0), 0.02, th, a.phi); }
      else { rig.tTheta = th; rig.tPhi = a.phi; }
      // 标记圈：放在该星座中心方向
      const v = eqv(c[0], c[1], R * 0.98);
      ring.position.set(v.x, v.y, v.z);
      ring.lookAt(0, 0, 0);
      ring.visible = true;
      ring.material.opacity = 0.5;
      ring.scale.setScalar(R * 0.06);
      highlightCons(k);
      return cs;
    }

    function starPanel(i) {
      const s = C3D.SKY_STARS[i];
      if (!s) return null;
      const [ra, dec, mg, bv, zh, en, desig] = s;
      const con = desig.split(' ').pop();
      const consZh = (C3D.SKY_CONS[con] || {}).zh || '';
      const T = Math.round(bvTemp(bv) / 100) * 100;
      const kind = mg < 1 ? '全天最亮级恒星' : mg < 3 ? '亮恒星' : '肉眼可见恒星';
      const colorName = bv < 0.2 ? '蓝白' : bv < 0.6 ? '白' : bv < 0.9 ? '黄白' : bv < 1.2 ? '橙黄' : '橙红';
      return {
        id: 'star' + i, kind, cn: zh || (en + ' ' + desig), en: (en || '') + ' · ' + desig,
        tagline: zh ? zh + '：' + colorName + '色光，表面约 ' + T + ' K' : colorName + '色光，表面约 ' + T + ' K',
        stats: [
          ['视星等', mg.toFixed(2)],
          ['表面温度', T + ' K'],
          ['色指数 B−V', bv.toFixed(2)],
          ['赤经', ra.toFixed(1) + '°'],
          ['赤纬', dec.toFixed(1) + '°'],
          ['所属星座', consZh || con]
        ],
        desc: '视星等每差 1 等，亮度差 2.512 倍；6 等是人眼在完全没有光污染时能看到的极限。' +
              '「颜色 = 温度」：越蓝越热（10000 K 以上），越橙越冷（3000 K 左右）。',
        facts: [
          '视星等 m 与绝对星等 M 的关系：m − M = 5·log₁₀(d/10pc)，d 是距离（秒差距）。',
          zh ? zh + '在冬夜/夏夜星空中属于容易辨认的亮星。' : '这一颗没有中文通用名，拜耳命名法是 ' + desig + '。'
        ]
      };
    }

    function consPanel(k) {
      const cs = STARMAP_CONS[k];
      if (!cs) return null;
      const c = CON[cs.abbr] || { c: [0, 0], rank: 0, b: ['', 0], en: cs.en };
      return {
        id: k, kind: '星座 · 全天 88 个天区之一', cn: cs.name, en: cs.en,
        tagline: cs.one,
        stats: [
          ['最亮星', cs.star],
          ['视星等', cs.mag],
          ['中心赤经', c.c[0].toFixed(0) + '°'],
          ['中心赤纬', c.c[1].toFixed(0) + '°'],
          ['最佳观测', cs.season]
        ],
        desc: cs.fact,
        facts: [
          '星座是「天球上的区域」，不是「一组挨在一起的星」——同一个星座里的星，彼此可能相差上千光年。',
          '88 个星座把整个天球分成互不重叠的 88 块，这是 1922 年 IAU 定下的国际标准。'
        ]
      };
    }

    function info() {
      if (state.selStar >= 0) { const p = starPanel(state.selStar); if (p) return p; }
      if (state.selCons) { const p = consPanel(state.selCons); if (p) return p; }
      return consPanel(state.centerCons) || consPanel('ori');
    }

    function setConsVisible(v) {
      state.showLines = !!v;
      lineGroup.visible = state.showLines;
    }

    const api = {
      name: 'starmap', scene, labels, pickables,
      near: 1, far: 2200, minRadius: 0.02, maxRadius: 0.06,
      bloom: 0.55, exposure: 1.0, bloomThreshold: 0.34, fov: 52,
      state,
      getState: () => state,
      stations: CONS_ORDER,
      consInfo: STARMAP_CONS,
      info, starPanel, consPanel, setLightPollution, setFov, setConsVisible, goToCons, goToRaDec,
      setObs, setObsDate, setSite, sites: SITES,
      obsState: () => state.obs,
      obsInfo: () => lastObs,
      enter() {
        Core.rig.zoomEnabled = false;
        state.tFov = state.fov = 52;
        state.selCons = null; state.selStar = -1;
        setLightPollution(state.lp);
        setConsVisible(state.showLines);
        const a = anglesFor(88.79, 7.41);   // 先看猎户
        Core.rig.snap(new THREE.Vector3(0, 0, 0), 0.02, a.theta, a.phi);
        state.centerCons = 'ori';
      },
      update(dt) {
        // 视场缓动
        if (Math.abs(state.tFov - state.fov) > 0.01) {
          state.fov += (state.tFov - state.fov) * Math.min(1, dt * 9);
          Core.camera.fov = state.fov;
          Core.camera.updateProjectionMatrix();
        }
        const sc = Math.pow(52 / Math.max(12, state.fov), 0.55) * Math.min(2, Core.renderer.getPixelRatio());
        starMat.uniforms.uScale.value = sc * 1.15;
        mwMat.uniforms.uScale.value = sc * (state.obs ? 0.70 : 1.15);
        ring.rotation.z += dt * 0.35;
        if (state.obs) {   // 观测模式：视角不能钻到地平线以下
          const rg = Core.rig;
          // 相机在球内朝外看：φ 是相机位置的天顶角，仰角 alt = φ − 90°
          rg.tPhi = Math.max(1.50, Math.min(3.03, rg.tPhi));
        }
        if (ring.visible) ring.material.opacity = 0.35 + 0.12 * Math.sin(t * 2.2);
        t += dt;
      },
      focus(id) { api.goToCons(id); },
      reset() {
        const a = anglesFor(88.79, 7.41);
        Core.rig.tTheta = a.theta; Core.rig.tPhi = a.phi;
        state.tFov = 52; state.selCons = null; state.selStar = -1;
        ring.visible = false;
        highlightCons(null);
        setConsVisible(true);
        Core.rig.zoomEnabled = false;
      },
      setLightPollution, setFov, setConsVisible, goToCons,
      // 点选：返回被点到的恒星索引或星座
      pick(hit) {
        const o = hit.object;
        if (o.userData.pickKind === 'stars' && hit.index !== undefined && hit.index !== null) {
          state.selStar = hit.index; state.selCons = null;
          return { type: 'star', index: hit.index };
        }
        if (o.userData.pickKind === 'cons') {
          const abbr = o.userData.abbr;
          const k = CONS_ORDER.find(x => STARMAP_CONS[x].abbr === abbr);
          if (k) { state.selCons = k; state.selStar = -1; highlightCons(k); return { type: 'cons', id: k }; }
        }
        return null;
      },
      api_fov: () => state.fov
    };
    api.setFov = setFov;
    return api;
  }

  C3D.buildStarmap = build;
  C3D.STARMAP_CONS = STARMAP_CONS;
  C3D.STARMAP_ORDER = CONS_ORDER;
})();