/* ============================================================
   COSMOS 3D — 程序化贴图
   所有纹理在浏览器里即时生成，不依赖任何外部图片。
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;

  /* ---------- 确定性随机 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 3D 值噪声 ---------- */
  const PERM = new Uint8Array(512);
  (function () {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rnd = mulberry32(20261116);
    for (let i = 255; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();

  function fade(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hash3(ix, iy, iz) {
    return PERM[(PERM[(PERM[ix & 255] + iy) & 255] + iz) & 255] / 255;
  }

  function noise3(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
    const n000 = hash3(ix, iy, iz), n100 = hash3(ix + 1, iy, iz);
    const n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
    const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1);
    const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);
    return lerp(
      lerp(lerp(n000, n100, fx), lerp(n010, n110, fx), fy),
      lerp(lerp(n001, n101, fx), lerp(n011, n111, fx), fy),
      fz
    );
  }

  function fbm(x, y, z, oct, lac, gain) {
    let a = 0.5, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      s += a * noise3(x * f, y * f, z * f);
      norm += a; a *= gain; f *= lac;
    }
    return s / norm;
  }

  /* ---------- 画布工具 ---------- */
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function toTexture(c, repeatX) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeatX) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
    t.needsUpdate = true;
    return t;
  }

  function mix(c1, c2, t) {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t
    ];
  }

  /* 球面经纬 -> 单位向量 */
  function sph(u, v) {
    const lon = u * TAU, lat = (0.5 - v) * Math.PI;
    const cl = Math.cos(lat);
    return [cl * Math.cos(lon), Math.sin(lat), cl * Math.sin(lon)];
  }

  /* ---------- 行星表面：逐像素生成 ---------- */
  function paintSphere(w, h, fn) {
    const c = canvas(w, h), ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const p = sph(u, v);
        const col = fn(p[0], p[1], p[2], u, v);
        const i = (y * w + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, ctx: ctx };
  }

  /* ---------- 环形山 ---------- */
  function craters(ctx, w, h, count, seed, tint, maxR) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const latScale = Math.max(0.35, Math.cos((y / h - 0.5) * Math.PI));
      const r = (2 + Math.pow(rnd(), 2.6) * maxR) * (0.6 + latScale * 0.7);
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * w;
        if (cx < -r * 2 || cx > w + r * 2) continue;
        const g = ctx.createRadialGradient(cx - r * 0.28, y - r * 0.28, r * 0.06, cx, y, r);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.10 + rnd() * 0.10) + ')');
        g.addColorStop(0.45, 'rgba(' + tint + ',' + (0.02 + rnd() * 0.05) + ')');
        g.addColorStop(0.82, 'rgba(0,0,0,' + (0.10 + rnd() * 0.12) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill();
      }
    }
  }

  /* ---------- 各地貌 ---------- */
  const PLANET_PAINTERS = {
    mercury(cfg) {
      const { canvas: c, ctx } = paintSphere(1024, 512, (x, y, z) => {
        const n = fbm(x * 3.2, y * 3.2, z * 3.2, 5, 2.1, 0.52);
        const m = fbm(x * 13, y * 13, z * 13, 3, 2.0, 0.5);
        let v = 0.42 + n * 0.42 + m * 0.07;
        const base = mix([92, 87, 80], [172, 166, 156], v);
        return base;
      });
      craters(ctx, 1024, 512, 420, 9911, '120,115,105', 26);
      return c;
    },
    venus(cfg) {
      const { canvas: c, ctx } = paintSphere(1024, 512, (x, y, z) => {
        const warp = fbm(x * 1.6 + 4.2, y * 3.0, z * 1.6, 4, 2.0, 0.55);
        const n = fbm(x * 2.2 + warp * 2.4, y * 9.0, z * 2.2, 5, 2.0, 0.55);
        const band = 0.5 + 0.5 * Math.sin(y * 11.0 + n * 4.0);
        let v = 0.36 + n * 0.5 + band * 0.14;
        return mix([176, 138, 84], [248, 231, 196], Math.min(1, v));
      });
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#fff4d8';
      for (let i = 0; i < 26; i++) {
        const y = (i / 26) * 512 + Math.sin(i) * 6;
        ctx.fillRect(0, y, 1024, 5);
      }
      ctx.globalAlpha = 1;
      return c;
    },
    earth(cfg) {
      const W = 2048, H = 1024;
      const { canvas: c, ctx } = paintSphere(W, H, (x, y, z, u, v) => {
        const lat = Math.abs(v - 0.5) * 2;
        const cont = fbm(x * 1.65 + 11.3, y * 1.65, z * 1.65 + 4.1, 6, 2.05, 0.52);
        const detail = fbm(x * 7.5 + 2, y * 7.5, z * 7.5, 4, 2.1, 0.5);
        let hgt = cont * 0.78 + detail * 0.22;
        // 让极地与高纬更多陆地，避免所有大陆挤在赤道
        hgt += lat * 0.05;
        const sea = 0.495;
        let col;
        if (hgt < sea) {
          const depth = (sea - hgt) / sea;
          col = mix([12, 62, 112], [4, 22, 58], Math.pow(depth, 0.6));
          // 浅海
          if (depth < 0.12) col = mix([32, 116, 160], [12, 62, 112], depth / 0.12);
        } else {
          const e = (hgt - sea) / (1 - sea);
          const dry = fbm(x * 4.0 + 9, y * 4.0, z * 4.0, 3, 2.0, 0.5);
          if (e < 0.08) col = [176, 168, 120];
          else if (e < 0.3) col = mix([64, 108, 58], [110, 130, 66], (e - 0.08) / 0.22);
          else if (e < 0.55) col = mix([110, 130, 66], [138, 122, 84], (e - 0.3) / 0.25);
          else col = mix([138, 122, 84], [196, 190, 176], Math.min(1, (e - 0.55) / 0.3));
          if (dry > 0.62 && e < 0.45) col = mix(col, [198, 170, 112], (dry - 0.62) / 0.38 * 0.8);
          if (e > 0.62) col = mix(col, [235, 238, 240], (e - 0.62) / 0.38);
        }
        // 极冠
        const ice = Math.max(0, (lat - 0.80) / 0.10) * (0.6 + 0.4 * detail);
        if (ice > 0) col = mix(col, [236, 244, 250], Math.min(1, ice));
        // 云层投影（轻）
        const cloud = fbm(x * 3.4 + 20, y * 6.0, z * 3.4, 4, 2.0, 0.55);
        if (cloud > 0.66) col = mix(col, [236, 240, 245], (cloud - 0.66) * 1.5);
        return col;
      });
      return c;
    },
    mars(cfg) {
      const { canvas: c, ctx } = paintSphere(1400, 700, (x, y, z, u, v) => {
        const lat = Math.abs(v - 0.5) * 2;
        const n = fbm(x * 2.4 + 3, y * 2.4, z * 2.4, 5, 2.05, 0.55);
        const d = fbm(x * 8.0, y * 8.0, z * 8.0, 4, 2.1, 0.5);
        let vv = 0.42 + n * 0.5 + d * 0.1;
        let col = mix([116, 52, 32], [214, 124, 74], vv);
        if (n < 0.42) col = mix(col, [88, 44, 34], (0.42 - n) * 1.6);
        if (d > 0.62) col = mix(col, [196, 130, 92], (d - 0.62) * 1.2);
        const ice = Math.max(0, (lat - 0.86) / 0.08);
        if (ice > 0) col = mix(col, [240, 236, 230], Math.min(1, ice));
        return col;
      });
      craters(ctx, 1400, 700, 190, 4417, '90,44,30', 16);
      return c;
    },
    jupiter(cfg) {
      const W = 1600, H = 800;
      const { canvas: c, ctx } = paintSphere(W, H, (x, y, z, u, v) => {
        const turb = fbm(x * 3.0 + 7, y * 6.5, z * 3.0, 5, 2.1, 0.55);
        const fine = fbm(x * 11, y * 22, z * 11, 3, 2.0, 0.5);
        const bandCoord = y * 17.0 + turb * 3.2 + fine * 0.6;
        const band = Math.sin(bandCoord) * 0.5 + 0.5;
        const band2 = Math.sin(bandCoord * 2.7 + 1.4) * 0.5 + 0.5;
        let col = mix([196, 158, 112], [248, 235, 208], band * 0.7 + band2 * 0.3);
        if (band < 0.22) col = mix(col, [150, 104, 74], (0.22 - band) / 0.22 * 0.85);
        if (band > 0.86) col = mix(col, [255, 246, 226], (band - 0.86) / 0.14 * 0.7);
        // 极区偏灰
        const lat = Math.abs(v - 0.5) * 2;
        col = mix(col, [150, 140, 130], Math.max(0, (lat - 0.72) / 0.28) * 0.55);
        return col;
      });
      // 大红斑
      const gx = W * 0.63, gy = H * 0.66, rx = W * 0.085, ry = H * 0.048;
      const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, rx);
      g.addColorStop(0, 'rgba(196,72,38,0.95)');
      g.addColorStop(0.55, 'rgba(178,84,52,0.8)');
      g.addColorStop(0.85, 'rgba(206,160,120,0.35)');
      g.addColorStop(1, 'rgba(206,160,120,0)');
      ctx.save(); ctx.translate(gx, gy); ctx.scale(1, ry / rx); ctx.translate(-gx, -gy);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, rx, 0, TAU); ctx.fill();
      ctx.restore();
      return c;
    },
    saturn(cfg) {
      const { canvas: c, ctx } = paintSphere(1400, 700, (x, y, z, u, v) => {
        const turb = fbm(x * 2.6, y * 5.2, z * 2.6, 4, 2.1, 0.5);
        const bandCoord = y * 15.0 + turb * 2.2;
        const band = Math.sin(bandCoord) * 0.5 + 0.5;
        let col = mix([208, 186, 138], [246, 236, 206], band * 0.85 + 0.1);
        if (band < 0.18) col = mix(col, [186, 158, 108], (0.18 - band) / 0.18 * 0.6);
        const lat = Math.abs(v - 0.5) * 2;
        col = mix(col, [170, 168, 158], Math.max(0, (lat - 0.78) / 0.22) * 0.5);
        return col;
      });
      return c;
    },
    uranus(cfg) {
      const { canvas: c, ctx } = paintSphere(1024, 512, (x, y, z, u, v) => {
        const n = fbm(x * 2.0, y * 6.0, z * 2.0, 4, 2.0, 0.5);
        const band = Math.sin(y * 9.0 + n * 2.0) * 0.5 + 0.5;
        let col = mix([132, 206, 212], [180, 232, 236], n * 0.6 + band * 0.4);
        const lat = Math.abs(v - 0.5) * 2;
        col = mix(col, [150, 210, 216], Math.max(0, (lat - 0.7) / 0.3) * 0.5);
        return col;
      });
      return c;
    },
    neptune(cfg) {
      const { canvas: c, ctx } = paintSphere(1024, 512, (x, y, z, u, v) => {
        const turb = fbm(x * 2.4, y * 5.0, z * 2.4, 4, 2.1, 0.52);
        const band = Math.sin(y * 10.0 + turb * 2.4) * 0.5 + 0.5;
        let col = mix([36, 58, 148], [78, 110, 214], band * 0.55 + turb * 0.45);
        const lat = Math.abs(v - 0.5) * 2;
        col = mix(col, [90, 120, 190], Math.max(0, (lat - 0.76) / 0.24) * 0.6);
        return col;
      });
      // 大暗斑
      ctx.save();
      ctx.globalAlpha = 0.6;
      const g = ctx.createRadialGradient(760, 330, 4, 760, 330, 90);
      g.addColorStop(0, 'rgba(18,28,80,0.95)');
      g.addColorStop(0.7, 'rgba(24,38,96,0.5)');
      g.addColorStop(1, 'rgba(24,38,96,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(760, 330, 90, 46, -0.15, 0, TAU); ctx.fill();
      ctx.restore();
      return c;
    },
    moon(cfg) {
      const { canvas: c, ctx } = paintSphere(1024, 512, (x, y, z) => {
        const n = fbm(x * 3.4, y * 3.4, z * 3.4, 5, 2.1, 0.5);
        const m = fbm(x * 1.2 + 5, y * 1.2, z * 1.2, 3, 2.0, 0.55);
        let v = 0.36 + n * 0.5;
        let col = mix([96, 94, 90], [196, 192, 184], v);
        // 月海
        if (m < 0.44) col = mix(col, [62, 62, 64], (0.44 - m) * 2.4);
        return col;
      });
      craters(ctx, 1024, 512, 520, 777, '120,118,112', 22);
      return c;
    }
  };

  /* ---------- 云层 ---------- */
  function makeClouds() {
    const W = 1600, H = 800;
    const c = canvas(W, H), ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const p = sph(u, v);
        const warp = fbm(p[0] * 2.2 + 3, p[1] * 2.2, p[2] * 2.2, 3, 2.0, 0.5);
        const n = fbm(p[0] * 4.0 + warp * 1.8, p[1] * 7.5, p[2] * 4.0, 5, 2.1, 0.55);
        const band = 0.5 + 0.5 * Math.sin(p[1] * 7.0 + 0.6);
        let a = (n - 0.44) * 2.1 * (0.55 + band * 0.6);
        a = Math.max(0, Math.min(1, a));
        const i = (y * W + x) * 4;
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  /* ---------- 太阳 ---------- */
  function makeSun() {
    const W = 1024, H = 512;
    const { canvas: c, ctx } = paintSphere(W, H, (x, y, z) => {
      const n1 = fbm(x * 6.0, y * 6.0, z * 6.0, 4, 2.0, 0.55);
      const n2 = fbm(x * 16.0 + 3, y * 16.0, z * 16.0, 3, 2.1, 0.5);
      const v = n1 * 0.65 + n2 * 0.35;
      return mix([255, 150, 40], [255, 248, 214], Math.pow(v, 1.35));
    });
    return c;
  }

  /* ---------- 光环 ---------- */
  function makeRing() {
    const W = 1024, H = 16;
    const c = canvas(W, H), ctx = c.getContext('2d');
    const rnd = mulberry32(31415);
    for (let x = 0; x < W; x++) {
      const t = x / W;
      let a = 0.72;
      // 环缝
      const gaps = [[0.05, 0.09, 0.05], [0.35, 0.40, 0.12], [0.62, 0.665, 0.95], [0.80, 0.815, 0.35]];
      for (const g of gaps) {
        if (t > g[0] && t < g[1]) a *= (1 - g[2]);
      }
      // 细密条纹
      const stripe = 0.55 + 0.45 * Math.sin(t * 210 + rnd() * 1.2) * Math.sin(t * 47 + 1.7);
      a *= 0.55 + 0.45 * stripe;
      a = Math.max(0.02, Math.min(1, a));
      const shade = 0.72 + 0.28 * Math.sin(t * 31 + 0.6);
      const col = mix([196, 176, 140], [246, 238, 218], shade);
      ctx.fillStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + a + ')';
      ctx.fillRect(x, 0, 1, H);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  /* ---------- 光晕 sprite ---------- */
  function glowTexture(stops, size) {
    size = size || 256;
    const c = canvas(size, size), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) g.addColorStop(s[0], s[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ---------- 星点 ---------- */
  function dotTexture() {
    const S = 64;
    const c = canvas(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(200,220,255,0.28)');
    g.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function softTexture() {
    const S = 64;
    const c = canvas(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ---------- 分子云 / 星云 sprite ---------- */
  function nebulaTexture(hue) {
    const S = 128;
    const c = canvas(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'hsla(' + hue + ',80%,70%,0.75)');
    g.addColorStop(0.35, 'hsla(' + hue + ',75%,55%,0.28)');
    g.addColorStop(0.7, 'hsla(' + hue + ',70%,45%,0.07)');
    g.addColorStop(1, 'hsla(' + hue + ',70%,40%,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- 包装 ---------- */
  const cache = {};
  const Tex = {
    _cache: cache,
    planet(name) {
      if (cache['p_' + name]) return cache['p_' + name];
      const painter = PLANET_PAINTERS[name];
      if (!painter) return null;
      const c = painter({});
      const t = toTexture(c, true);
      cache['p_' + name] = t;
      return t;
    },
    sun() {
      if (!cache.sun) cache.sun = toTexture(makeSun(), true);
      return cache.sun;
    },
    clouds() {
      if (!cache.clouds) cache.clouds = makeClouds();
      return cache.clouds;
    },
    ring() {
      if (!cache.ring) cache.ring = makeRing();
      return cache.ring;
    },
    dot() {
      if (!cache.dot) cache.dot = dotTexture();
      return cache.dot;
    },
    soft() {
      if (!cache.soft) cache.soft = softTexture();
      return cache.soft;
    },
    css(hex) {
      const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',1)';
    },
    glow(inner, outer) {
      const key = inner + '|' + outer;
      if (!cache['g_' + key]) {
        cache['g_' + key] = glowTexture([
          [0, inner], [0.25, inner.replace(/[\d.]+\)$/, '0.55)')], [0.55, outer], [1, 'rgba(0,0,0,0)']
        ], 256);
      }
      return cache['g_' + key];
    },
    nebula(hue) {
      const key = 'n_' + hue;
      if (!cache[key]) cache[key] = nebulaTexture(hue);
      return cache[key];
    }
  };

  C3D.Tex = Tex;
  C3D.noise = { fbm, noise3, mulberry32 };
})();
