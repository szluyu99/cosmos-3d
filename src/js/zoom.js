/* =========================================================================
 * zoom.js — 连续宇宙缩放（D）
 * 一个场景、一条连续的对数距离轴：从 1.7 米的人一路拉到 8.8×10^26 米。
 * 做法：所有物体共用原点，渲染尺寸 = 真实尺寸 / 当前视野尺寸（10^dex）。
 *       dex 每变化 1，物体缩放 10 倍 —— 于是「拉远」时旧物体缩成点、新物体从点长大。
 * ========================================================================= */
(function () {
  const C3D = window.C3D = window.C3D || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------------- 数据 */
  const STATIONS = [
    {
      id: 'human', dex: 0.23, kind: 'human', name: '一个人', en: 'HUMAN · 1.7 M',
      size: '1.7 米', color: '#8fd0ff', article: 'scale',
      tagline: '一切尺度的起点。',
      stats: [['身高', '1.7 m'], ['质量', '62 kg'], ['细胞数', '约 3.7×10¹³'], ['占宇宙质量', '≈10⁻⁵²']],
      desc: '此刻你看到的这一小块东西，就是你全部人生发生的尺度。接下来滚轮每往下滚一格，视野就放大十倍。',
      facts: ['人体大约由 37 万亿个细胞组成', '一个人如果把所有细胞排开，长度可绕地球数圈']
    },
    {
      id: 'tree', dex: 2.0, kind: 'tree', name: '一棵红杉', en: 'REDWOOD · 100 M',
      size: '100 米', color: '#6ee7b7', article: 'scale',
      tagline: '比人高六十倍的邻居。',
      stats: [['高度', '约 100 m'], ['树龄', '可达 2000 年'], ['重量', '约 1000 吨']],
      desc: '一棵成年红杉的高度接近三十层楼。再放大十倍，整片森林和街区就会进入视野。',
      facts: ['最高的现存树木「海波龙」高 115.9 米', '红杉的根系很浅，靠群体互相支撑']
    },
    {
      id: 'city', dex: 3.7, kind: 'city', name: '一座城市', en: 'CITY · 5 KM',
      size: '5 公里', color: '#93c5fd', article: 'scale',
      tagline: '几万人的灯火连成一圈。',
      stats: [['尺度', '约 5 km'], ['步行穿越', '约 1 小时'], ['光速穿过', '约 17 微秒']],
      desc: '从太空看，城市只是夜面上一小片橙色光斑。再放大十倍，你才能看见山川与海岸线。',
      facts: ['光走过一座五公里的城市，只需 17 微秒', '城市灯光是夜空间里最直接的人造标记']
    },
    {
      id: 'orbit', dex: 5.62, kind: 'orbit', name: '近地轨道', en: 'LEO · 400 KM',
      size: '400 公里', color: '#7dd3fc', article: 'earth',
      tagline: '从这儿看，地球就是整个视野。',
      stats: [['高度', '400 km'], ['速度', '7.66 km/s'], ['一圈', '92 分钟'], ['可见宽度', '约 4 000 km']],
      desc: '空间站在这个高度绕地球一圈只要 92 分钟。大气层从这里是贴着地平线的一条细蓝线——所有天气、所有云、所有生命都发生在这条线以下。',
      facts: ['空间站每 90 分钟绕一圈，一天能看到 16 次日出', '在这个高度，地球边缘的大气只有几公里厚']
    },
    {
      id: 'earth', dex: 7.1, kind: 'earth', name: '地球', en: 'EARTH · 12 742 KM',
      size: '12 742 公里', color: '#38bdf8', article: 'earth',
      tagline: '目前已知唯一有生命的星球。',
      stats: [['直径', '12 742 km'], ['周长', '40 075 km'], ['年龄', '46 亿年'], ['表面被水覆盖', '71%']],
      desc: '整个人类文明都发生在这层薄薄的蓝色薄膜上。大气层的主要成分——氮和氧——只占地球半径的不到 1%。',
      facts: ['地球到太阳的光要走 8 分 20 秒', '如果把地球缩成一个苹果，大气层比苹果皮还薄']
    },
    {
      id: 'moon', dex: 8.58, kind: 'moon', name: '地月距离', en: 'EARTH–MOON · 384 400 KM',
      size: '38.4 万公里', color: '#cbd5e1', article: 'moon',
      tagline: '光只需要 1.3 秒就能走完。',
      stats: [['平均距离', '384 400 km'], ['光行时间', '1.28 秒'], ['月球直径', '3 474 km'], ['距离/直径', '约 111 倍']],
      desc: '这个距离能塞下太阳系其余七颗行星——这是「太阳系尺度」的第一次真正跳跃。',
      facts: ['地月之间可以并排放下其余七颗行星', '月球正以每年 3.8 厘米远离地球']
    },
    {
      id: 'sun', dex: 9.14, kind: 'sun', name: '太阳', en: 'SUN · 1.39 M KM',
      size: '139 万公里', color: '#fbbf24', article: 'sun',
      tagline: '占太阳系 99.86% 的质量。',
      stats: [['直径', '1.39×10⁶ km'], ['表面温度', '5 772 K'], ['核心温度', '1 570 万 K'], ['光能到地球', '8 分 20 秒']],
      desc: '太阳每秒把 6 亿吨氢聚变成氦，其中约 400 万吨质量直接变成能量。',
      facts: ['太阳直径约是地球的 109 倍', '阳光从核心走到表面要花十几万年']
    },
    {
      id: 'au', dex: 11.18, kind: 'au', name: '日地距离', en: '1 AU · 149.6 M KM',
      size: '1.496 亿公里', color: '#fcd34d', article: 'light',
      tagline: '太阳系的尺子，光走 8 分 20 秒。',
      stats: [['距离', '1.496 亿 km'], ['光行时间', '8 分 20 秒'], ['公转周期', '365.26 天'], ['阳光到海王星', '4 小时 10 分']],
      desc: '1 AU 就是「日地距离」，天文学整套坐标都从这里出发。你看到的太阳永远是 8 分钟前的太阳——如果它现在熄灭，我们还能再亮 8 分钟。',
      facts: ['1 AU 现在是精确值：149 597 870 700 米', '太阳光从核心走到表面要十几万年，从表面到地球只要 8 分钟']
    },
    {
      id: 'sol', dex: 12.96, kind: 'sol', name: '太阳系', en: 'SOLAR SYSTEM · 9.1 B KM',
      size: '91 亿公里', color: '#7dd3fc', article: 'solar',
      tagline: '海王星轨道以内的全部空间。',
      stats: [['海王星轨道直径', '约 9.1×10⁹ km'], ['光穿过', '约 8.4 小时'], ['已知行星', '8 颗'], ['奥尔特云外缘', '约 10 万 AU']],
      desc: '如果把太阳缩成一个直径 30 米的大球，海王星轨道就是 30 公里外的一个沙粒。',
      facts: ['旅行者 1 号飞了 48 年才走完 160 AU', '太阳光到海王星要走 4 小时 10 分']
    },
    {
      id: 'void', dex: 14.6, kind: 'void', name: '星际空间', en: 'INTERSTELLAR SPACE · ~4 LY',
      size: '约 4 光年', color: '#64748b', article: 'light',
      tagline: '这一格几乎是空的。',
      stats: [['到比邻星', '4.24 光年'], ['平均密度', '约 1 个原子/cm³'], ['温度', '2.7 K'], ['主要成分', '氢']],
      desc: '太阳系和最近的恒星之间，是四光年的近乎真空。旅行者 1 号飞了 48 年只走了 160 AU——不到这段路的 0.15%。这一格的「空」，本身就是宇宙最重要的事实之一。',
      facts: ['星际空间每立方厘米平均只有约 1 个原子，地球大气是 2.5×10¹⁹ 个', '旅行者 1 号还要飞约 7 万年才能抵达比邻星']
    },
    {
      id: 'prox', dex: 16.6, kind: 'prox', name: '比邻星', en: 'PROXIMA CENTAURI · 4.24 LY',
      size: '4.0×10¹³ 公里', color: '#fca5a5', article: 'star',
      tagline: '离我们最近的另一颗恒星。',
      stats: [['距离', '4.246 光年'], ['折合', '40.2 万亿 km'], ['最快飞船', '需 7 万年'], ['行星', '比邻星 b 位于宜居带']],
      desc: '这一格跨越了 4 个数量级：从以「小时」计的太阳系，跳到以「年」计的星际空间。',
      facts: ['以现有最快飞船，到比邻星要飞 7 万年', '它是三合星系统的一员，表面常有强烈耀斑']
    },
    {
      id: 'nebula', dex: 19.1, kind: 'nebula', name: '猎户座大星云', en: 'M42 · 1 344 LY',
      size: '1 344 光年', color: '#67e8f9', article: 'dust',
      tagline: '一团正在造星的气体云。',
      stats: [['距离', '1 344 光年'], ['直径', '24 光年'], ['年龄', '约 300 万年'], ['状态', '正在形成恒星']],
      desc: '猎户座腰带下面那块模糊的光斑，其实是一片恒星育婴室。你现在看到的光，是 1 344 年前从那里出发的——那时中国还是唐朝。',
      facts: ['M42 里有大量原行星盘，正在同时诞生几十颗恒星', '它中间的梯形星团只有 30 万年历史']
    },
    {
      id: 'galaxy', dex: 20.98, kind: 'galaxy', name: '银河系', en: 'MILKY WAY · 100 000 LY',
      size: '10 万光年', color: '#a78bfa', article: 'galaxy',
      tagline: '一千亿颗恒星组成的旋涡。',
      stats: [['直径', '约 10 万光年'], ['恒星数', '1000–4000 亿'], ['中心黑洞', '人马座 A* 430 万 M☉'], ['太阳位置', '距中心 2.6 万光年']],
      desc: '太阳带着整个太阳系，以每秒 230 公里绕银心公转，一圈要 2.3 亿年。',
      facts: ['一束光穿过银河系盘面要 10 万年', '银河系正在和仙女座星系缓慢靠近']
    },
    {
      id: 'group', dex: 23.0, kind: 'group', name: '本星系群', en: 'LOCAL GROUP · 10 M LY',
      size: '1000 万光年', color: '#67e8f9', article: 'galaxy',
      tagline: '银河系和它的五十多个邻居。',
      stats: [['直径', '约 1000 万光年'], ['主要成员', '仙女座、银河系、三角座'], ['成员数', '80 个以上'], ['引力主导', '仙女座与银河系']],
      desc: '本星系群本身被引力绑在一起。再往外，星系团和纤维结构开始出现——宇宙网。',
      facts: ['仙女座星系正以每秒 110 公里靠近银河系', '本星系群在室女座超星系团的边缘']
    },
    {
      id: 'supercluster', dex: 24.02, kind: 'supercluster', name: '室女座超星系团', en: 'VIRGO SUPERCLUSTER · 110 M LY',
      size: '1.1 亿光年', color: '#93c5fd', article: 'galaxy',
      tagline: '银河系只是它边缘的一个星系。',
      stats: [['直径', '1.1 亿光年'], ['成员', '至少 100 个星系群'], ['中心', '室女座星系团'], ['银河系位置', '最边缘']],
      desc: '引力把上千个星系绑成一片。我们所在的本星系群，只是这片结构最外缘的一小团。',
      facts: ['室女座星系团有 1 300 多个星系', '银河系正朝室女座方向下落，速度约 185 km/s']
    },
    {
      id: 'cosmicweb', dex: 24.98, kind: 'cosmicweb', name: '宇宙网', en: 'COSMIC WEB · 1 B LY',
      size: '10 亿光年', color: '#c4b5fd', article: 'dark',
      tagline: '星系沿着暗物质的纤维排成一张网。',
      stats: [['尺度', '10 亿光年'], ['结构', '纤维 + 空洞'], ['骨架', '暗物质'], ['空洞直径', '可达 3 亿光年']],
      desc: '星系并不均匀地撒开。它们沿着暗物质纤维聚成丝、结成团，中间留出巨大的空洞——这就是宇宙网。',
      facts: ['最大的空洞「牧夫座空洞」直径约 3.3 亿光年', '纤维本身由暗物质主导，发光气体只是跟着走']
    },
    {
      id: 'universe', dex: 26.94, kind: 'universe', name: '可观测宇宙', en: 'OBSERVABLE UNIVERSE · 93 B LY',
      size: '930 亿光年', color: '#e9d5ff', article: 'galaxy',
      tagline: '光来得及走到我们这里的那一部分。',
      stats: [['直径', '约 930 亿光年'], ['年龄', '138 亿年'], ['星系数', '约 2 万亿'], ['宇宙微波背景', '2.725 K']],
      desc: '注意直径大于 138 亿光年的两倍——空间本身在膨胀。我们看到的最远处，发出的光已经走了 138 亿年。',
      facts: ['可观测宇宙的直径是 930 亿光年，不是 138 亿', '宇宙微波背景是它婴儿时期留下的余温']
    }
  ];

  const FIRST_DEX = STATIONS[0].dex;
  const LAST_DEX = STATIONS[STATIONS.length - 1].dex;

  /* ------------------------------------------------------------ 随机工具 */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const rnd = rng(20261117);

  const mat = (color, o) => new THREE.MeshBasicMaterial(Object.assign({ color }, o || {}));
  function glowSprite(size, hex, opacity) {
    const m = new THREE.SpriteMaterial({
      map: C3D.Tex.glow('#ffffff', 'rgba(255,255,255,0)'),
      color: new THREE.Color(hex), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  }
  function dashedLine(a, b, color, opacity, dash) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = new THREE.LineDashedMaterial({
      color, transparent: true, opacity, dashSize: dash || 0.03, gapSize: dash || 0.03
    });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    return l;
  }

  /* -------------------------------------------------------------- 模型库 */
  function buildHuman() {
    const g = new THREE.Group();
    const skin = mat(0xbae6fd);
    const cloth = mat(0x38bdf8);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), skin);
    head.position.y = 0.24;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.28, 6, 18), cloth);
    body.position.y = -0.03;
    const legG = new THREE.CapsuleGeometry(0.043, 0.26, 4, 10);
    [-0.055, 0.055].forEach(x => {
      const l = new THREE.Mesh(legG, mat(0x0ea5e9));
      l.position.set(x, -0.31, 0);
      g.add(l);
    });
    const armG = new THREE.CapsuleGeometry(0.032, 0.24, 4, 10);
    [-0.145, 0.145].forEach(x => {
      const a = new THREE.Mesh(armG, mat(0x0ea5e9));
      a.position.set(x, 0.0, 0);
      a.rotation.z = x > 0 ? 0.18 : -0.18;
      g.add(a);
    });
    g.add(head, body);
    g.add(glowSprite(1.5, 0x7dd3fc, 0.18));
    return g;
  }

  function buildTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.42, 12), mat(0x7c4a2d));
    trunk.position.y = -0.24;
    g.add(trunk);
    [[0.34, 0.0, 0x2f8f5b], [0.26, 0.2, 0x3fae70], [0.18, 0.38, 0x5fd08a]].forEach(s => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(s[0], 0.34, 16), mat(s[2]));
      c.position.y = s[1];
      g.add(c);
    });
    g.add(glowSprite(1.6, 0x6ee7b7, 0.1));
    return g;
  }

  function buildCity() {
    const g = new THREE.Group();
    const r = rng(77);
    const cols = [-0.32, -0.16, 0, 0.16, 0.32];
    const rows = [-0.32, -0.16, 0, 0.16, 0.32];
    cols.forEach(x => rows.forEach(z => {
      const h = 0.06 + r() * 0.42;
      const w = 0.1;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(0x1e3a5f));
      b.position.set(x, h / 2 - 0.36, z);
      b.material = mat(0x2a4a73);
      g.add(b);
      // 窗灯
      const n = Math.max(2, Math.round(h * 26));
      for (let i = 0; i < n; i++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), mat(i % 3 ? 0xfbbf24 : 0xfde68a));
        d.position.set(x + (r() - 0.5) * 0.06, -0.36 + r() * h, z + w / 2 + 0.002);
        g.add(d);
      }
    }));
    g.add(glowSprite(2.0, 0x93c5fd, 0.12));
    return g;
  }

  function buildEarth() {
    const g = new THREE.Group();
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48), new THREE.MeshBasicMaterial({ map: C3D.Tex.planet('earth') }));
    g.add(e);
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(0.53, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
      })
    );
    g.add(atm);
    return g;
  }

  function buildMoon() {
    const g = new THREE.Group();
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.155, 40, 30), new THREE.MeshBasicMaterial({ map: C3D.Tex.planet('earth') }));
    e.position.x = -0.28;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 18), mat(0xcbd5e1));
    m.position.x = 0.34;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
    atm.position.x = -0.28;
    g.add(e, atm, m);
    g.add(dashedLine(new THREE.Vector3(-0.12, 0, 0), new THREE.Vector3(0.30, 0, 0), 0x93c5fd, 0.55, 0.02));
    return g;
  }

  function buildSun() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48), new THREE.MeshBasicMaterial({ map: C3D.Tex.sun() }));
    g.add(s);
    g.add(glowSprite(1.55, 0xfbbf24, 0.55));
    g.add(glowSprite(2.0, 0xf59e0b, 0.2));
    return g;
  }

  function buildSolar() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 18), mat(0xfbbf24)));
    g.add(glowSprite(0.52, 0xfbbf24, 0.55));
    const radii = [0.09, 0.14, 0.19, 0.25, 0.31, 0.38, 0.44, 0.5];
    const cols = [0xa8a29e, 0xfbbf24, 0x60a5fa, 0xf87171, 0xfbbf24, 0xfde68a, 0x67e8f9, 0x818cf8];
    radii.forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.0075, r + 0.0075, 96),
        new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.62, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const a = i * 1.7;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.013 + (i % 3) * 0.004, 12, 10), mat(cols[i]));
      p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.add(p);
    });
    return g;
  }


  function buildVoid() {
    const g = new THREE.Group();
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 0.2 + rnd() * 0.6;
      const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r * 0.7;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.030, color: 0x94a3b8, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
    })));
    // 旅行者 1 号：一个小亮点 + 长长的尾迹
    const probe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), mat(0xfde68a));
    probe.position.set(-0.18, 0.04, 0.1);
    g.add(probe);
    const pg = glowSprite(0.30, 0xfde68a, 0.85); pg.position.copy(probe.position); g.add(pg);
    g.add(dashedLine(new THREE.Vector3(-0.5, 0.11, 0.28), new THREE.Vector3(-0.19, 0.042, 0.1), 0xfbbf24, 0.5, 0.03));
    return g;
  }

  function buildProxima() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 18), mat(0xfde68a));
    a.position.set(-0.26, 0.05, 0);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), mat(0xfca5a5));
    b.position.set(0.16, -0.12, 0.04);
    g.add(a, b);
    g.add(glowSprite(0.62, 0xfbbf24, 0.5));
    g.add(dashedLine(new THREE.Vector3(-0.2, 0.02, 0), new THREE.Vector3(0.12, -0.09, 0.04), 0xfca5a5, 0.72, 0.02));
    return g;
  }

  function buildGalaxy() {
    const g = new THREE.Group();
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c1 = new THREE.Color(0xfde68a), c2 = new THREE.Color(0x818cf8);
    for (let i = 0; i < N; i++) {
      const arm = i % 2;
      const t = Math.pow(rnd(), 0.62);
      const r = t * 0.5;
      const a = arm * Math.PI + t * 5.4 + (rnd() - 0.5) * 0.42;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.012 * (1.4 - t);
      pos[i * 3 + 2] = Math.sin(a) * r;
      const c = c1.clone().lerp(c2, t);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.030, vertexColors: true, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
    })));
    g.add(glowSprite(0.3, 0xfde68a, 0.5));
    g.rotation.x = 0.5;
    return g;
  }

  function buildGroup() {
    const g = new THREE.Group();
    const blobs = [
      { p: [0, 0, 0], s: 0.24, c: 0xfde68a, n: 700 },
      { p: [0.34, 0.1, -0.06], s: 0.16, c: 0x93c5fd, n: 420 },
      { p: [-0.28, -0.14, 0.1], s: 0.12, c: 0xfca5a5, n: 300 }
    ];
    blobs.forEach(b => {
      const pos = new Float32Array(b.n * 3);
      for (let i = 0; i < b.n; i++) {
        const r = Math.pow(rnd(), 0.5) * b.s;
        const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
        pos[i * 3] = b.p[0] + Math.sin(ph) * Math.cos(th) * r;
        pos[i * 3 + 1] = b.p[1] + Math.cos(ph) * r * 0.6;
        pos[i * 3 + 2] = b.p[2] + Math.sin(ph) * Math.sin(th) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.030, color: b.c, transparent: true, opacity: 0.82,
        blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
      })));
    });
    return g;
  }

  function buildUniverse() {
    const g = new THREE.Group();
    const N = 3200;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c1 = new THREE.Color(0xe9d5ff), c2 = new THREE.Color(0x38bdf8), c3 = new THREE.Color(0xfbbf24);
    for (let i = 0; i < N; i++) {
      const r = 0.5 * (0.35 + 0.65 * Math.cbrt(rnd()));
      const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      const t = rnd();
      const c = t < 0.6 ? c1.clone().lerp(c2, rnd()) : c3.clone().lerp(c1, rnd() * 0.5);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.026, vertexColors: true, transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
    })));
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.07 })
    );
    g.add(shell);
    return g;
  }


  function buildOrbit() {
    const g = new THREE.Group();
    // 地球边缘（大球的下半部分）
    const limb = new THREE.Mesh(new THREE.SphereGeometry(0.95, 64, 40), new THREE.MeshBasicMaterial({ map: C3D.Tex.planet('earth') }));
    limb.position.y = -1.16;
    g.add(limb);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
    atm.position.y = -1.16;
    g.add(atm);
    // 空间站：核心舱 + 太阳能板
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 12), mat(0xe2e8f0));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.22;
    g.add(body);
    const panelG = new THREE.BoxGeometry(0.11, 0.001, 0.05);
    [-0.085, 0.085].forEach(x => {
      const pn = new THREE.Mesh(panelG, mat(0x1d4ed8));
      pn.position.set(x, 0.22, 0);
      g.add(pn);
    });
    g.add(glowSprite(0.42, 0x7dd3fc, 0.3));
    return g;
  }

  function buildAU() {
    const g = new THREE.Group();
    const sx = -0.52, ex = 0.52;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), new THREE.MeshBasicMaterial({ map: C3D.Tex.sun() }));
    sun.position.x = sx;
    g.add(sun);
    const sg = glowSprite(0.85, 0xfbbf24, 0.55); sg.position.x = sx; g.add(sg);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 20, 14), new THREE.MeshBasicMaterial({ map: C3D.Tex.planet('earth') }));
    e.position.x = ex;
    g.add(e);
    g.add(dashedLine(new THREE.Vector3(sx + 0.18, 0, 0), new THREE.Vector3(ex - 0.04, 0, 0), 0xfcd34d, 0.55, 0.02));
    return g;
  }

  function buildNebula() {
    const g = new THREE.Group();
    const N = 2400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c1 = new THREE.Color(0x67e8f9), c2 = new THREE.Color(0xa78bfa), c3 = new THREE.Color(0xfbbf24);
    for (let i = 0; i < N; i++) {
      const r = Math.pow(rnd(), 0.55) * 0.5;
      const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.25;
      pos[i * 3 + 1] = Math.cos(ph) * r * 0.62;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r * 0.9;
      const t = rnd();
      const c = t < 0.45 ? c1.clone().lerp(c2, rnd()) : (t < 0.8 ? c2.clone().lerp(c3, rnd() * 0.6) : c3.clone());
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.028, vertexColors: true, transparent: true, opacity: 0.60,
      blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
    })));
    g.add(spriteCloud(0x67e8f9, 1.5, 0.16, 0, 0, 0));
    g.add(spriteCloud(0xa78bfa, 1.15, 0.14, 0.22, 0.06, -0.1));
    g.add(spriteCloud(0xfbbf24, 0.7, 0.12, -0.2, -0.05, 0.12));
    return g;
  }

  function spriteCloud(hex, size, opacity, x, y, z) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: C3D.Tex.nebula(hex), color: 0xffffff, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.setScalar(size);
    sp.position.set(x || 0, y || 0, z || 0);
    return sp;
  }

  function buildSupercluster() {
    const g = new THREE.Group();
    const cores = [
      [0, 0, 0, 0.14, 0xfde68a, 520],
      [0.3, 0.08, -0.05, 0.09, 0x93c5fd, 300],
      [-0.28, -0.1, 0.06, 0.08, 0xfca5a5, 260],
      [0.04, -0.22, 0.12, 0.07, 0xc4b5fd, 220],
      [-0.06, 0.22, -0.04, 0.06, 0x67e8f9, 200]
    ];
    cores.forEach(c => {
      const pos = new Float32Array(c[5] * 3);
      for (let i = 0; i < c[5]; i++) {
        const r = Math.pow(rnd(), 0.5) * c[3];
        const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
        pos[i * 3] = c[0] + Math.sin(ph) * Math.cos(th) * r * 1.5;
        pos[i * 3 + 1] = c[1] + Math.cos(ph) * r * 0.55;
        pos[i * 3 + 2] = c[2] + Math.sin(ph) * Math.sin(th) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.034, color: c[4], transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
      })));
      const sp = spriteCloud(c[4], c[3] * 4.4, 0.16, c[0], c[1], c[2]);
      g.add(sp);
    });
    return g;
  }

  function buildCosmicWeb() {
    const g = new THREE.Group();
    const nodes = [];
    const N = 90;
    for (let i = 0; i < N; i++) {
      const r = Math.pow(rnd(), 0.45) * 0.5;
      const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
      nodes.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.75, Math.sin(ph) * Math.sin(th) * r));
    }
    const seg = [];
    nodes.forEach((n, i) => {
      // 每个节点连最近的 2 个邻居
      const d = nodes.map((m, j) => ({ j, d: n.distanceToSquared(m) }))
        .filter(o => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
      d.forEach(o => { if (o.j > i) seg.push(n, nodes[o.j]); });
    });
    const lg = new THREE.BufferGeometry().setFromPoints(seg);
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: 0x8b5cf6, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
    })));
    const pos = new Float32Array(nodes.length * 3);
    nodes.forEach((n, i) => { pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.038, color: 0xe9d5ff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, map: C3D.Tex.dot(), alphaTest: 0.01
    })));
    return g;
  }

  const BUILDERS = {
    human: buildHuman, tree: buildTree, city: buildCity, orbit: buildOrbit,
    earth: buildEarth, moon: buildMoon, sun: buildSun, au: buildAU,
    sol: buildSolar, void: buildVoid, prox: buildProxima, nebula: buildNebula,
    galaxy: buildGalaxy, group: buildGroup, supercluster: buildSupercluster,
    cosmicweb: buildCosmicWeb, universe: buildUniverse
  };

  /* ---------------------------------------------------------------- 场景 */
  function build(Core) {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    scene.add(root);

    const R_CAM = 2.6;
    const VIEW_H = 2 * R_CAM * Math.tan(Core.camera.fov * Math.PI / 360);

    const items = STATIONS.map((st, i) => {
      const g = new THREE.Group();
      const inner = BUILDERS[st.kind]();
      g.add(inner);
      g.visible = false;
      root.add(g);
      const mats = [];
      inner.traverse(o => {
        if (o.material) {
          o.material.transparent = true;
          if (o.material.userData.baseOpacity === undefined) o.material.userData.baseOpacity = o.material.opacity;
          if (o.material.userData.baseTransparent === undefined) o.material.userData.baseTransparent = o.material.transparent;
          mats.push(o.material);
        }
      });
      return { st, idx: i, g, inner, mats };
    });

    const state = {
      dex: FIRST_DEX, target: FIRST_DEX, playing: false,
      current: 0, autoFrame: true, userMoved: false
    };

    function setGroupOpacity(it, o) {
      for (const m of it.mats) {
        const base = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity : 1;
        m.opacity = base * o;
        m.transparent = o < 0.999 || m.userData.baseTransparent;
      }
      it.g.visible = o > 0.004;
    }

    /* 标签 */
    const labels = STATIONS.map(st => ({
      id: st.id, text: st.name + ' · ' + st.size, cls: 'zoom-label',
      pos: () => {
        const it = items[st.__i];
        if (!it || !it.g.visible || state.current !== st.__i) return null;
        return new THREE.Vector3(0, 0.62, 0);
      }
    }));
    STATIONS.forEach((st, i) => { st.__i = i; });

    /* 拾取 */
    const pickables = [];
    items.forEach(it => {
      it.inner.traverse(o => {
        if (o.isMesh || o.isPoints || o.isSprite) {
          o.userData.pickId = it.st.id;
          pickables.push(o);
        }
      });
    });

    /* 交互：滚轮 / 双指 = 缩放 */
    const el = Core.canvas;
    const onWheel = e => {
      if (!Core.active || Core.active.name !== 'zoom') return;
      e.preventDefault();
      const d = clamp(e.deltaY, -140, 140);
      setDex(state.target + d * 0.0022, true);
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    let pinch = 0;
    const ts = e => {
      if (e.touches.length === 2) pinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
    };
    const tm = e => {
      if (e.touches.length === 2 && pinch && Core.active && Core.active.name === 'zoom') {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        setDex(state.target + (pinch - d) * 0.012, true);
        pinch = d;
      }
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', () => { pinch = 0; }, { passive: true });

    function setDex(v, fromUser) {
      state.target = clamp(v, FIRST_DEX - 0.4, LAST_DEX + 0.4);
      state.playing = false;
      if (fromUser) state.userMoved = true;
      state.autoFrame = true;
    }

    const api = {
      name: 'zoom', scene, labels, pickables,
      near: 0.01, far: 200, minRadius: 1.2, maxRadius: 7,
      bloom: 0.0, exposure: 1.0, bloomThreshold: 0.8,
      state, timeControl: false,

      getState() { return { dex: state.dex, target: state.target, current: state.current, playing: state.playing }; },

      enter() {
        Core.rig.zoomEnabled = false;
        Core.rig.snap(new THREE.Vector3(0, 0, 0), R_CAM, 0.62, 1.15);
        if (state.dex < FIRST_DEX || state.dex > LAST_DEX) {
          state.dex = state.target = FIRST_DEX;
        }
      },

      update(dt) {
        if (state.playing) {
          state.target += dt * 0.62;
          if (state.target >= LAST_DEX) { state.target = LAST_DEX; state.playing = false; }
        }
        const k = Math.min(1, dt * 7);
        state.dex += (state.target - state.dex) * k;
        if (Math.abs(state.target - state.dex) < 0.0008) state.dex = state.target;

        root.rotation.y += dt * 0.05;

        let best = 0, bestScore = -1e9;
        for (const it of items) {
          const L = it.st.dex - state.dex;      // log10(当前渲染尺寸)
          const s = Math.pow(10, L);
          // 太大（把镜头包进几何体）淡出；太小（缩成一个点）淡出
          const op = clamp((1.0 - L) / 0.62, 0, 1) * clamp((L + 2.5) / 0.9, 0, 1);
          if (op > 0.004 && s < 14) {
            it.g.scale.setScalar(s);
            setGroupOpacity(it, op);
          } else {
            it.g.visible = false;
          }
          const score = op - Math.abs(L) * 0.002;
          if (score > bestScore) { bestScore = score; best = it.idx; }
        }
        state.current = best;
      },

      /* 当前站点的信息卡 */
      info() {
        const st = STATIONS[state.current] || STATIONS[0];
        return {
          id: st.id, kind: '尺度 ' + st.en.split('·')[0].trim(), cn: st.name, en: st.en,
          stats: st.stats, desc: st.desc, facts: st.facts, tagline: st.tagline
        };
      },
      currentInfo() { return STATIONS[state.current] || STATIONS[0]; },

      setDex(v) { setDex(v, true); },
      setStation(i) {
        const st = STATIONS[clamp(i, 0, STATIONS.length - 1)];
        setDex(st.dex, true);
      },
      setPlaying(v) {
        if (v && state.target >= LAST_DEX - 0.01) state.target = FIRST_DEX;
        state.playing = !!v;
      },
      togglePlay() { api.setPlaying(!state.playing); return state.playing; },
      reset() {
        state.dex = state.target = FIRST_DEX;
        state.playing = false;
        state.current = 0;
        Core.rig.snap(new THREE.Vector3(0, 0, 0), R_CAM, 0.62, 1.15);
      },
      focus() {
        Core.rig.flyTo(new THREE.Vector3(0, 0, 0), R_CAM, { theta: 0.62, phi: 1.15 });
      },
      // 供 UI 面板
      stations: STATIONS,
      dexRange: [FIRST_DEX, LAST_DEX],
      viewMeters() { return Math.pow(10, state.dex); }
    };

    return api;
  }

  C3D.ZOOM_STATIONS = STATIONS;
  C3D.buildZoom = build;
})();