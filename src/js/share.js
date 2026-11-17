/* ==========================================================================
   share.js — 分享导出：把当前画面渲染成一张带标题 / 关键数据 / 出处的水印海报
   --------------------------------------------------------------------------
   设计要点：
   - 画面复用 Core.snapshot(w,h)（离屏 RT，含泛光），再接 2D canvas 叠文字；
   - 海报比例跟随当前视口，保证构图不变形；
   - 文字用系统字体，导出的是纯 PNG，不依赖任何在线资源。
   ========================================================================== */
(function () {
  'use strict';
  const C3D = window.C3D;
  const BG = '#05070e';
  const SCENE_CN = { solar: '太阳系', stellar: '恒星的一生', galaxy: '银河系', deep: '深空', zoom: '宇宙缩放', starmap: '星空' };
  const SCENE_TAG = {
    solar: '八颗行星、一颗恒星，和把这一切都收进一个薄盘里的距离。',
    stellar: '从分子云到白矮星、中子星或黑洞 —— 一颗恒星的一生。',
    galaxy: '上千亿颗恒星组成的旋涡，我们的太阳只是其中一粒尘埃。',
    deep: '黑洞、星云、星系并合 —— 宇宙里最极端的天体。',
    zoom: '从一个人的身高，一路滚到可观测宇宙的边缘，三十个数量级。',
    starmap: '真实星表铺出的天球：2061 颗恒星、88 个星座。'
  };
  const INK = '#f2f7ff';
  const DIM = '#7f96b3';
  const ACCENT = '#ffcf8a';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fileStamp(d) {
    d = d || new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes());
  }

  /* 当前场景要印在纸上的信息 */
  function gather() {
    const C = C3D.Core;
    const UI = C3D.UI;
    const scene = UI.scene;
    const id = UI.selected;
    const meta = (UI.SCENES && UI.SCENES[scene]) || { title: SCENE_CN[scene] || '宇宙漫游', intro: SCENE_TAG[scene] || '' };
    let o = null;
    if (C.active && C.active.info) o = C.active.info();
    if (!o && id) {
      const src = (C3D.DATA && C3D.DATA[scene]) || {};
      const d = Array.isArray(src) ? src.find(x => x.id === id) : (id ? src[id] : null);
      if (d) o = { cn: d.cn, en: d.en, kind: d.kind, tagline: d.tagline, stats: d.stats || [] };
    }
    if (!o) o = { cn: meta.title || '宇宙漫游', en: '', kind: '', tagline: meta.intro || '', stats: [] };

    const stats = (o.stats || []).slice(0, 4).map(s => [String(s[0]), String(s[1])]);

    /* 观测模式：把「此刻、此地」写上去，这是最有分享价值的一行 */
    let sub = '';
    let dateLine = stamp();
    if (scene === 'starmap' && C.active.obsState && C.active.obsState()) {
      const ob = C.active.obsInfo && C.active.obsInfo();
      if (ob && ob.site) {
        const s = ob.site;
        const phase = ob.moonPhase >= 0.02 ? Math.round(ob.moonPhase * 100) + '%' : '新月';
        sub = s.cn + ' · 北纬 ' + s.lat.toFixed(1) + '° · 太阳 ' + Math.round(ob.sunAlt) + '°' +
          ' · 月亮 ' + Math.round(ob.moonAlt) + '° · ' + phase;
        dateLine = stamp(ob.date || new Date());
      }
    }

    return {
      scene: scene,
      cn: o.cn || meta.title || '宇宙漫游',
      en: o.en || '',
      kind: o.kind || '',
      tagline: (o.tagline || meta.intro || '').replace(/\s+/g, ' '),
      stats: stats,
      sub: sub,
      dateLine: dateLine
    };
  }

  function wrapText(cx, text, maxW) {
    const lines = [];
    let cur = '';
    for (const ch of String(text)) {
      const t = cur + ch;
      if (cx.measureText(t).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* 渲染海报：返回 { url, w, h, meta } */
  function render() {
    const C = C3D.Core;
    const cv = C.renderer.domElement;
    const aspect = Math.max(0.9, Math.min(2.6, cv.clientWidth / Math.max(1, cv.clientHeight)));
    const W = 2400;
    const IH = Math.round(W / aspect);
    const BAND = 470;
    const H = IH + BAND;

    const meta = gather();

    /* 1. 3D 画面：临时把相机宽高比改成海报比例，避免拉伸 */
    const cam = C.camera;
    const oldAspect = cam.aspect;
    cam.aspect = W / IH;
    cam.updateProjectionMatrix();
    let url = null;
    try { url = C.snapshot(W, IH); } catch (e) { url = null; }
    cam.aspect = oldAspect;
    cam.updateProjectionMatrix();

    /* 2. 合成画布 */
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const cx = out.getContext('2d');
    cx.fillStyle = BG;
    cx.fillRect(0, 0, W, H);

    const img = new Image();
    const finish = () => {
      if (img.complete && img.naturalWidth) {
        cx.drawImage(img, 0, 0, W, IH);
      } else {
        const g = cx.createLinearGradient(0, 0, W, IH);
        g.addColorStop(0, '#0a1224'); g.addColorStop(1, '#05070e');
        cx.fillStyle = g; cx.fillRect(0, 0, W, IH);
      }
      drawOverlay(cx, W, IH, H, BAND, meta);
      share.dataURL = out.toDataURL('image/png');
      share.jpegURL = out.toDataURL('image/jpeg', 0.94);
      share.w = W; share.h = H; share.meta = meta;
      if (share.onReady) share.onReady(share.dataURL, meta);
    };
    if (url) { img.onload = finish; img.src = url; }
    else { finish(); }

    return { w: W, h: H, meta: meta };
  }

  function drawOverlay(cx, W, IH, H, BAND, m) {
    /* 底部压暗，保证文字永远压得住 */
    const g = cx.createLinearGradient(0, Math.max(0, IH - 420), 0, IH);
    g.addColorStop(0, 'rgba(5,7,14,0)');
    g.addColorStop(0.62, 'rgba(5,7,14,0.55)');
    g.addColorStop(1, 'rgba(5,7,14,0.97)');
    cx.fillStyle = g;
    cx.fillRect(0, Math.max(0, IH - 420), W, Math.min(420, IH));

    /* 左上角品牌 */
    cx.save();
    cx.fillStyle = 'rgba(242,247,255,0.86)';
    cx.font = '600 34px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
    cx.fillText('宇宙漫游', 96, 108);
    const bw = cx.measureText('宇宙漫游').width;
    cx.fillStyle = ACCENT;
    cx.beginPath(); cx.arc(96 + bw + 26, 96, 7, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = 'rgba(242,247,255,0.5)';
    cx.font = '500 26px ui-monospace,SFMono-Regular,Menlo,monospace';
    cx.fillText('COSMOS 3D', 96 + bw + 52, 106);
    cx.restore();

    /* 右上角：观测地点与时间（这张图「什么时候、在哪儿」） */
    if (m.sub) {
      cx.textAlign = 'right';
      cx.fillStyle = 'rgba(255,207,138,0.94)';
      cx.font = '500 27px "PingFang SC",system-ui,sans-serif';
      cx.fillText(m.sub, W - 96, 106);
      cx.fillStyle = 'rgba(242,247,255,0.55)';
      cx.font = '400 24px ui-monospace,SFMono-Regular,Menlo,monospace';
      cx.fillText(m.dateLine, W - 96, 146);
      cx.textAlign = 'left';
    }

    const x = 96;
    const kindY = IH + 84;
    const titleY = IH + 170;
    let ty = IH + 226;

    /* 类别 */
    if (m.kind) {
      cx.fillStyle = ACCENT;
      cx.font = '600 28px "PingFang SC","Hiragino Sans GB",system-ui,sans-serif';
      cx.fillText(m.kind, x, kindY);
    }

    /* 主标题 + 英文名 */
    cx.fillStyle = INK;
    cx.font = '700 88px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
    cx.fillText(m.cn, x, titleY);
    const titleW = cx.measureText(m.cn).width;
    if (m.en) {
      cx.fillStyle = 'rgba(143,184,230,0.92)';
      cx.font = '500 32px ui-monospace,SFMono-Regular,Menlo,monospace';
      cx.fillText(m.en.toUpperCase(), x + titleW + 30, titleY - 4);
    }

    /* 一句话（最多两行） */
    if (m.tagline) {
      cx.fillStyle = 'rgba(207,224,242,0.92)';
      cx.font = '400 36px "PingFang SC","Hiragino Sans GB",system-ui,sans-serif';
      const lines = wrapText(cx, m.tagline, W - x * 2 - 60).slice(0, 2);
      lines.forEach((ln, i) => cx.fillText(ln, x, ty + i * 48));
    }

    /* 关键数据 */
    if (m.stats.length) {
      const sy = H - 104;
      let sx = x;
      m.stats.forEach(s => {
        cx.fillStyle = DIM;
        cx.font = '500 24px "PingFang SC",system-ui,sans-serif';
        cx.fillText(s[0], sx, sy - 40);
        cx.fillStyle = INK;
        cx.font = '600 36px ui-monospace,SFMono-Regular,Menlo,monospace';
        cx.fillText(s[1], sx, sy);
        const w = Math.max(cx.measureText(s[0]).width, cx.measureText(s[1]).width) + 66;
        cx.strokeStyle = 'rgba(120,150,190,0.22)';
        cx.beginPath(); cx.moveTo(sx + w - 32, sy - 56); cx.lineTo(sx + w - 32, sy + 10); cx.stroke();
        sx += w;
      });
    }

    /* 底部出处 */
    cx.fillStyle = 'rgba(120,145,175,0.75)';
    cx.font = '400 23px ui-monospace,SFMono-Regular,Menlo,monospace';
    cx.textAlign = 'right';
    cx.fillText('本图由 cosmos-3d 生成', W - 96, H - 40);
    cx.textAlign = 'left';
    cx.fillText('可交互 3D 宇宙课堂 · three.js', x, H - 40);
  }

  function caption(m) {
    const parts = [m.cn + (m.en ? ' / ' + m.en : '')];
    if (m.tagline) parts.push(m.tagline);
    if (m.stats.length) parts.push(m.stats.map(s => s[0] + ' ' + s[1]).join(' · '));
    if (m.sub) parts.push(m.sub + ' · ' + m.dateLine);
    parts.push('— 来自《宇宙漫游》3D 宇宙课堂');
    return parts.join('\n');
  }

  function download(kind) {
    const png = kind === 'png';
    if (!share.dataURL || (png === false && !share.jpegURL)) return false;
    const url = png ? share.dataURL : (share.jpegURL || share.dataURL);
    const m = share.meta || { scene: 'cosmos', cn: 'cosmos' };
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cosmos3d-' + m.scene + '-' + fileStamp() + (png ? '.png' : '.jpg');
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  function copyText() {
    const txt = caption(share.meta || { cn: '宇宙漫游', stats: [] });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(() => true, () => false);
    }
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return Promise.resolve(ok);
  }

  const share = {
    dataURL: null,
    meta: null,
    w: 0, h: 0,
    onReady: null,
    render: render,
    download: download,
    copyText: copyText,
    caption: function () { return caption(share.meta || { cn: '宇宙漫游', stats: [] }); }
  };

  C3D.share = share;
})();
