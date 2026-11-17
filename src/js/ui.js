/* ============================================================
   COSMOS 3D — 界面 / 教学交互
   ============================================================ */
(function () {
  const TAU = Math.PI * 2;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const SCENES = {
    solar: {
      title: '太阳系', rail: '太阳系 · 目的地',
      hint: '拖拽旋转 · 滚轮缩放 · 点击天体',
      intro: '太阳系：一颗恒星与它剩下的 0.14% 碎屑。'
    },
    stellar: {
      title: '恒星演化', rail: '恒星演化 · 四条质量轨道',
      hint: '拖动时间轴 · 看一颗恒星怎么老去',
      intro: '恒星演化：同一套物理，四种结局——结局由出生时的质量决定。'
    },
    galaxy: {
      title: '银河系', rail: '银河系 · 结构',
      hint: '拖拽俯视银盘 · 滚轮拉远',
      intro: '银河系：约 1,000 亿颗恒星，太阳只是其中普通的一颗。'
    },
    deep: {
      title: '深空', rail: '深空 · 极端天体',
      hint: '点击标签，前往三种极端天体',
      intro: '深空：黑洞、超新星遗迹与星系并合。'
    },
    starmap: {
      title: '星空',
      rail: '星座 · 真实全天恒星',
      hint: '滚轮放大到 30° 以下会浮现星名 · 点恒星看温度 · 下方滑块调光污染',
      intro: '这是从地球看出去的整片天球：2061 颗真实恒星按赤道坐标铺开，88 个星座连线可以逐个数。'
    },
    zoom: {
      title: '宇宙缩放', rail: '尺度 · 从人到可观测宇宙',
      hint: '滚轮 / 双指连续缩放 · 拖动旋转 · 点物体看资料',
      intro: '连续宇宙缩放：把 10⁻¹ 到 10²⁷ 米压进一条可以滚动的轴。'
    }
  };

  const ORDER = {
    solar: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'belt'],
    stellar: ['red', 'sunlike', 'massive', 'huge'],
    galaxy: ['core', 'sunpos', 'orion', 'perseus', 'halo'],
    deep: ['bh', 'crab', 'merger'],
    zoom: ['human', 'tree', 'city', 'orbit', 'earth', 'moon', 'sun', 'au', 'sol', 'void', 'prox',
           'nebula', 'galaxy', 'group', 'supercluster', 'cosmicweb', 'universe'],
    starmap: ['ori', 'cma', 'gem', 'tau', 'uma', 'leo', 'cyg', 'lyr', 'aql', 'sco', 'and', 'cas', 'cru']
  };

  const TOTAL_DIVES = Object.keys(ORDER).reduce((n, k) => n + ORDER[k].length, 0);

  const LADDER = [
    { e: 0.23, name: '一个人', note: '你身体里的碳、氧、铁，全部来自恒星内部的核合成。你确实是宇宙认识自己的一种方式。' },
    { e: 2.0, name: '一座体育场', note: '100 米级。人类建造过最大的单体结构，放到行星尺度上仍然是一粒沙。' },
    { e: 4.1, name: '一座城市', note: '10 公里级。从太空看，城市的灯光是文明最显眼的痕迹。' },
    { e: 7.1, name: '地球', note: '直径 12,742 公里。目前已知唯一有生命的地方，也是我们全部知识的取样点。' },
    { e: 8.58, name: '地月距离', note: '38.4 万公里，光走 1.28 秒。这是太阳系里唯一能塞下其他七颗行星的距离。' },
    { e: 9.14, name: '太阳', note: '直径 139 万公里，地球可以装进去 130 万个。它每秒把 400 万吨质量变成光。' },
    { e: 11.18, name: '日地距离', note: '1.496 亿公里 = 1 AU。阳光走 8 分 20 秒——你看到的太阳永远是 8 分钟前的太阳。' },
    { e: 12.77, name: '海王星轨道', note: '30 AU。旅行者 2 号从地球飞到海王星用了 12 年。' },
    { e: 15.98, name: '一光年', note: '9.46 万亿公里。以现在最快的探测器，飞完一光年要一万八千年。' },
    { e: 16.60, name: '比邻星', note: '4.24 光年，最近的恒星。光要走 4 年 3 个月，而它身边就有一颗宜居带行星。' },
    { e: 20.90, name: '银河系', note: '直径约 10 万光年，1,000 亿颗恒星。太阳距银心 2.6 万光年，绕一圈要 2.3 亿年。' },
    { e: 22.90, name: '本星系群', note: '约 1,000 万光年。银河系与仙女座星系正以 110 km/s 相互靠近，约 45 亿年后并合。' },
    { e: 26.94, name: '可观测宇宙', note: '直径 930 亿光年。这不是宇宙的全部，只是光来得及到达我们的那一部分。' }
  ];

  const ARTICLE_FOR = {
    sun: 'star', mercury: 'scale', venus: 'life', earth: 'life', moon: 'life',
    mars: 'life', jupiter: 'scale', saturn: 'scale', uranus: 'scale',
    neptune: 'scale', belt: 'dust',
    core: 'bh', sunpos: 'galaxy', orion: 'dust', perseus: 'galaxy', halo: 'dark',
    bh: 'bh', crab: 'star', merger: 'galaxy',
    red: 'star', sunlike: 'star', massive: 'star', huge: 'bh',
    human: 'scale', tree: 'dust', city: 'scale', sol: 'scale',
    prox: 'star', galaxy: 'galaxy', group: 'galaxy', universe: 'galaxy',
    ori: 'star', cma: 'star', gem: 'star', tau: 'dust', uma: 'star', leo: 'star',
    cyg: 'bh', lyr: 'star', aql: 'star', sco: 'star', and: 'galaxy', cas: 'star', cru: 'star'
  };

  const UI = {
    C: null,
    scene: 'solar',
    selected: null,
    tour: null,
    quiz: null,
    labelsOn: true,
    orbitsOn: true,
    lastDate: '',

    init(Core) {
      this.C = Core;
      this.progress = C3D.Progress;
      this.progress.load();
      this.updateProgressChip();
      Core.onPick = (id, fromLabel) => this.select(id, { user: true, focus: true });
      Core.onSceneChange = (name) => { this.scene = name; };

      $$('#scene-tabs button').forEach(b => {
        b.addEventListener('click', () => this.switchScene(b.dataset.scene));
      });

      const lpEl = $('#sky-lp');
      if (lpEl) lpEl.addEventListener('input', e => {
        const v = +e.target.value;
        if (this.C.active && this.C.active.setLightPollution) this.C.active.setLightPollution(v);
        this.syncSkyPanel(true);
      });
      const siteSel = $('#obs-site');
      if (siteSel) {
        const sm = this.C.scenes.starmap;
        const sites = (sm && sm.sites) || [];
        siteSel.innerHTML = sites.map((x, i) => '<option value="' + i + '">' + x.cn + '</option>').join('');
        this.obsSiteIdx = 0;
      }
      const onObs = () => this.toggleObs();
      $('#obs-btn') && $('#obs-btn').addEventListener('click', onObs);
      $('#obs-exit') && $('#obs-exit').addEventListener('click', onObs);
      $('#obs-close') && $('#obs-close').addEventListener('click', () => { this.exitObs(); });
      $('#obs-now') && $('#obs-now').addEventListener('click', () => {
        const sm = this.C.scenes.starmap;
        if (!sm) return;
        sm.setObsDate(Date.now());
        this.syncObs();
        this.showToast('已回到此刻', 1400);
      });
      $('#obs-date') && $('#obs-date').addEventListener('change', e => {
        const sm = this.C.scenes.starmap;
        if (!sm || !sm.obsState()) return;
        const t = new Date(e.target.value).getTime();
        if (!isFinite(t)) return;
        sm.setObsDate(t);
        this.syncObs();
      });
      siteSel && siteSel.addEventListener('change', e => {
        const sm = this.C.scenes.starmap;
        if (!sm) return;
        this.obsSiteIdx = +e.target.value || 0;
        sm.setSite(this.obsSiteIdx);
        this.syncObs();
      });

      $('#rail-list').addEventListener('click', e => {
        const item = e.target.closest('.rail-item');
        if (!item) return;
        this.select(item.dataset.id, { user: true, focus: true });
      });
      $('#rail-toggle').addEventListener('click', () => {
        const rail = $('#rail');
        const btn = $('#rail-toggle');
        rail.classList.toggle('collapsed');
        const closed = rail.classList.contains('collapsed');
        btn.textContent = closed ? '›' : '‹';
        btn.title = closed ? '展开目的地列表' : '收起';
        btn.setAttribute('aria-expanded', String(!closed));
      });

      $('#info-close').addEventListener('click', () => this.hideInfo());
      $('#btn-reset').addEventListener('click', () => this.reset());
      $('#btn-full').addEventListener('click', () => this.toggleFull());
      $('#btn-help').addEventListener('click', () => this.openHelp());
      $('#btn-share').addEventListener('click', () => this.openShare());
      $('#btn-learn').addEventListener('click', () => this.openKB());
      $('#btn-quiz').addEventListener('click', () => this.openQuiz());
      $('#btn-tour').addEventListener('click', () => this.startTour(this.scene));
      $('#btn-progress').addEventListener('click', () => this.openProgress());
      $('#tg-scale').addEventListener('click', () => this.toggleScale());
      $('#st-play').addEventListener('click', () => this.toggleStellarPlay());
      $('#st-slider').addEventListener('input', e => {
        const v = +e.target.value / 1000;
        if (this.C.active.setProgress) this.C.active.setProgress(v);
        if (this.C.active.setPlaying) this.C.active.setPlaying(false);
        this.syncStellarPanel(true);
      });
      $('#zp-play').addEventListener('click', () => this.toggleZoomPlay());
      $('#zp-slider').addEventListener('input', e => {
        const v = +e.target.value / 1000;
        const a = this.C.active;
        if (a && a.setDex) {
          const r = a.dexRange, st = a.stations;
          let dex = r[0] + (r[1] - r[0]) * v;
          if (a.setDexToStation) a.setDexToStation(v);
          a.setDex(dex);
          a.setPlaying(false);
          this.syncZoomPanel(true);
        }
      });
      $('#hr-close').addEventListener('click', () => $('#hr-panel').classList.add('hidden'));
      $('#sn-close').addEventListener('click', () => this.toggleScale(false));
      $('#scale-note').addEventListener('click', e => {
        const b = e.target.closest('[data-real]');
        if (b) this.realAction(b.dataset.real);
      });

      $$('#dock-time .speed-btn').forEach(b => {
        b.addEventListener('click', () => this.setSpeed(+b.dataset.speed, true));
      });
      $('#tg-orbits').addEventListener('click', () => this.toggleOrbits());
      $('#tg-labels').addEventListener('click', () => this.toggleLabels());

      $('#tour-prev').addEventListener('click', () => this.tourStep(-1));
      $('#tour-next').addEventListener('click', () => this.tourStep(1));
      $('#tour-exit').addEventListener('click', () => this.endTour());
      $('#modal-close').addEventListener('click', () => this.closeModal());
      $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') this.closeModal(); });

      window.addEventListener('keydown', e => this.onKey(e));

      // 初始场景
      const hash = (location.hash || '').replace('#', '');
      const start = SCENES[hash] ? hash : 'solar';
      this.buildRail(start);
      this.switchScene(start, true);
      this.setSpeed(8, false);
      this.hideInfo();
      this.showToast('拖拽旋转视角 · 滚轮缩放 · 点击天体查看资料', 3600);
    },

    /* ---------------- 场景 ---------------- */
    switchScene(name, instant) {
      if (!SCENES[name]) return;
      if (this.tour) this.endTour(true);
      this.scene = name;
      const solarApi = this.C.scenes.solar;
      if (name !== 'solar' && solarApi && solarApi.real) solarApi.exitReal();
      this.C.setScene(name);
      $('#tg-scale').style.display = name === 'solar' ? '' : 'none';
      $('#stellar-panel').classList.toggle('hidden', name !== 'stellar');
      $('#hr-panel').classList.toggle('hidden', name !== 'stellar');
      $('#zoom-panel').classList.toggle('hidden', name !== 'zoom');
      $('#sky-panel').classList.toggle('hidden', name !== 'starmap');
      if (name !== 'starmap' && this.C.scenes.starmap && this.C.scenes.starmap.obsState &&
          this.C.scenes.starmap.obsState()) {
        this.C.scenes.starmap.setObs(false);
        $('#obs-bar').classList.add('hidden');
        document.body.classList.remove('obs');
        $('#obs-btn').classList.remove('hidden');
        $('#obs-btn').classList.remove('active');
        $('#obs-exit').classList.add('hidden');
      }
      // 缩放 / 星空场景自己接管滚轮与双指，其余场景交回相机
      this.C.rig.zoomEnabled = name !== 'zoom' && name !== 'starmap';
      if (name === 'zoom') {
        $('#tg-labels').style.display = 'none';
        $('#tg-orbits').style.display = 'none';
      } else {
        $('#tg-orbits').style.display = (name === 'solar' || name === 'starmap') ? '' : 'none';
        $('#tg-orbits').title = name === 'starmap' ? '显示 / 隐藏星座连线' : '显示 / 隐藏轨道线';
      }
      if (name !== 'solar') {
        $('#tg-scale').classList.remove('on');
        this.hideScaleNote();
      }
      $$('#scene-tabs button').forEach(b => b.classList.toggle('active', b.dataset.scene === name));
      this.buildRail(name);
      this.hideInfo();
      $('#rail-title').textContent = SCENES[name].rail;
      $('#dock-hint').textContent = SCENES[name].hint;
      $('#dock-time').style.display = name === 'solar' ? '' : 'none';
      $('#tg-orbits').style.display = (name === 'solar' || name === 'starmap') ? '' : 'none';
      $('#tg-labels').style.display = name === 'stellar' ? '' : '';
      if (name === 'solar') {
        this.C.active.setSpeed(this.currentSpeed === undefined ? 8 : this.currentSpeed);
        this.C.active.setOrbits(this.orbitsOn);
      }
      if (name === 'starmap') {
        this.orbitsOn = true;
        $('#tg-orbits').classList.add('on');
        if (this.C.active.setConsVisible) this.C.active.setConsVisible(true);
        this.select('ori', { focus: false, user: false });
        this.syncSkyPanel(true);
        this.showToast('滚轮 = 望远镜：把视场从 52° 推到 12°', 3000);
      }
      if (name === 'stellar') {
        this.selected = null;
        const tid = this.C.active.state.trackId;
        this.syncStellarPanel(true);
        this.select(tid, { focus: true, user: false });
        this.showToast('拖动下方时间轴 · 恒星会在你眼前老去', 3400);
      }
      this.applyLabels();
      try { history.replaceState(null, '', '#' + name); } catch (e) {}
      if (!instant) this.showToast(SCENES[name].intro, 2600);
    },

    buildRail(name) {
      const list = $('#rail-list');
      list.innerHTML = '';
      const data = C3D.DATA[name] || {};
      ORDER[name].forEach(id => {
        const o = data[id];
        if (!o) return;
        const b = document.createElement('button');
        b.className = 'rail-item';
        b.dataset.id = id;
        b.innerHTML =
          '<span class="swatch" style="color:' + (o.color || '#7dd3fc') + ';background:' + (o.color || '#7dd3fc') + '"></span>' +
          '<span class="rail-label">' + o.cn + '</span>' +
          '<span class="rail-sub">' + (o.kind || '').split('·')[0].trim() + '</span>' +
          '<span class="tick">✓</span>';
        list.appendChild(b);
      });
      this.syncRail();
    },

    syncRail() {
      const v = this.progress ? this.progress.data.visited : {};
      $$('#rail-list .rail-item').forEach(b => {
        b.classList.toggle('active', b.dataset.id === this.selected);
        b.classList.toggle('done', !!v[b.dataset.id]);
      });
    },

    /* ---------------- 选择与信息 ---------------- */
    select(id, opts) {
      opts = opts || {};
      const data = C3D.DATA[this.scene] || {};
      const o = data[id];
      if (!o) return;
      if (this.tour && opts.user) this.endTour(true);
      this.selected = id;
      if (this.scene === 'stellar' && this.C.active.setTrack && this.C.active.state.trackId !== id) {
        this.C.active.setTrack(id);
        this.syncStellarPanel(true);
      }
      if (this.scene === 'starmap' && this.C.active.goToCons) {
        this.C.active.goToCons(id);
      }
      if (this.scene === 'zoom' && this.C.active.setStation) {
        const zi = ORDER.zoom.indexOf(id);
        if (zi >= 0) this.C.active.setStation(zi);
      }
      if (this.progress.visit(id)) this.updateProgressChip();
      this.syncRail();
      this.renderInfo(o);
      if (opts.focus !== false && this.C.active.focus) {
        this.C.active.focus(id, { instant: false });
      }
    },

    renderInfo(o) {
      if ((this.scene === 'stellar' || this.scene === 'zoom' || this.scene === 'starmap') && this.C.active.info) o = this.C.active.info();
      this.showPanel(o);
    },

    showPanel(o) {
      if (!o) return;
      const panel = $('#info');
      $('#info-kind').textContent = o.kind || '天体';
      $('#info-title').textContent = o.cn;
      $('#info-en').textContent = o.en || '';
      const body = $('#info-body');
      let html = '';
      if (o.tagline) html += '<p class="info-tagline">' + o.tagline + '</p>';
      if (o.stats && o.stats.length) {
        html += '<dl class="stat-grid">';
        o.stats.forEach(s => {
          html += '<div class="stat"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>';
        });
        html += '</dl>';
      }
      if (o.desc) html += '<p class="info-desc">' + o.desc + '</p>';
      if (o.facts && o.facts.length) {
        html += '<div class="info-sub">值得记住</div><ul class="fact-list">';
        o.facts.forEach(f => { html += '<li>' + f + '</li>'; });
        html += '</ul>';
      }
      const art = C3D.ARTICLES.find(a => a.id === ARTICLE_FOR[o.id]);
      html += '<div class="info-actions">';
      if (art) html += '<button class="chip-btn" data-act="kb" data-id="' + art.id + '">延伸阅读 · ' + art.title + '</button>';
      html += '<button class="chip-btn" data-act="tour">带我看这一站</button>';
      html += '</div>';
      body.innerHTML = html;
      body.scrollTop = 0;
      body.onclick = e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        if (btn.dataset.act === 'kb') this.openKB(btn.dataset.id);
        if (btn.dataset.act === 'tour') this.startTour(this.scene, this.selected);
      };
      panel.classList.remove('hidden');
    },

    hideInfo() {
      $('#info').classList.add('hidden');
      this.selected = null;
      this.syncRail();
    },

    reset() {
      if (this.C.active.reset) this.C.active.reset();
      this.hideInfo();
      this.showToast('视角已重置', 1600);
    },

    /* ---------------- 时间 / 显示 ---------------- */
    setSpeed(v, announce) {
      this.currentSpeed = v;
      $$('#dock-time .speed-btn').forEach(b => b.classList.toggle('active', +b.dataset.speed === v));
      if (this.scene === 'solar' && this.C.active.setSpeed) this.C.active.setSpeed(v);
      if (announce) this.showToast(v === 0 ? '时间已暂停' : '时间流速 ' + (v === 8 ? '1×' : v === 40 ? '5×' : '20×'), 1400);
      this.updateDate(true);
    },

    toggleOrbits() {
      this.orbitsOn = !this.orbitsOn;
      $('#tg-orbits').classList.toggle('on', this.orbitsOn);
      if (this.scene === 'starmap' && this.C.active.setConsVisible) {
        this.C.active.setConsVisible(this.orbitsOn);
        return;
      }
      if (this.C.active.setOrbits) this.C.active.setOrbits(this.orbitsOn);
    },

    toggleLabels() {
      this.labelsOn = !this.labelsOn;
      $('#tg-labels').classList.toggle('on', this.labelsOn);
      this.applyLabels();
    },

    applyLabels() {
      if (this.C.active.setLabels) this.C.active.setLabels(this.labelsOn);
      else this.C.labelLayer.style.display = this.labelsOn ? '' : 'none';
    },

    updateDate(force) {
      if (this.scene !== 'solar' || !this.C.active.dateLabel) return;
      const d = this.C.active.dateLabel();
      if (d !== this.lastDate || force) {
        this.lastDate = d;
        $('#dock-date').textContent = d;
      }
    },

    /* ---------------- 导览 ---------------- */
    startTour(scene, focusId) {
      const tour = C3D.TOURS[scene];
      if (!tour) return;
      if (scene !== this.scene) this.switchScene(scene, true);
      let i = 0;
      if (focusId) {
        const k = tour.stops.findIndex(s => s.id === focusId);
        if (k >= 0) i = k;
      }
      this.tour = { scene, i };
      $('#tourbar').classList.remove('hidden');
      $('#btn-tour').classList.add('active');
      this.renderTour();
    },

    renderTour() {
      const t = this.tour;
      if (!t) return;
      const tour = C3D.TOURS[t.scene];
      const stop = tour.stops[t.i];
      const dots = $('#tour-dots');
      dots.innerHTML = tour.stops.map((_, i) => '<i class="' + (i === t.i ? 'on' : '') + '"></i>').join('');
      const obj = (C3D.DATA[t.scene] || {})[stop.id];
      $('#tour-text').innerHTML = '<b>' + (obj ? obj.cn : stop.id) + '</b>' + stop.text +
        '<span style="color:#66758f"> · ' + (t.i + 1) + '/' + tour.stops.length + '</span>';
      if (this.C.active.focus) this.C.active.focus(stop.id, { instant: false });
      this.select(stop.id, { focus: false });
    },

    tourStep(d) {
      if (!this.tour) return;
      const tour = C3D.TOURS[this.tour.scene];
      const n = this.tour.i + d;
      if (n < 0) return;
      if (n >= tour.stops.length) {
        this.progress.tour(tour.scene, tour.stops.length);
        this.updateProgressChip();
        this.endTour();
        this.showToast('导览结束 · 现在可以自由漫游了', 2400);
        return;
      }
      this.tour.i = n;
      this.renderTour();
    },

    endTour(silent) {
      if (!this.tour) return;
      this.tour = null;
      $('#tourbar').classList.add('hidden');
      $('#btn-tour').classList.remove('active');
      if (!silent) this.showToast('已退出导览', 1400);
    },

    /* ---------------- 知识库 ---------------- */
    openKB(articleId) {
      this.openModal('知识库', '已读 ' + this.progress.readCount() + '/' + C3D.ARTICLES.length + ' 篇 · 从尺度到暗能量');
      const body = $('#modal-body');
      body.innerHTML = '<div class="kb-side" id="kb-side"></div><div class="kb-main" id="kb-main"></div>';
      const side = $('#kb-side');
      const tool = document.createElement('button');
      tool.className = 'kb-tool';
      tool.innerHTML = '<b>尺度阶梯</b> · 从人到可观测宇宙';
      tool.addEventListener('click', () => this.openLadder());
      side.appendChild(tool);
      let lastCat = '';
      C3D.ARTICLES.forEach(a => {
        if (a.cat !== lastCat) {
          lastCat = a.cat;
          const h = document.createElement('div');
          h.className = 'kb-cat';
          h.textContent = a.cat;
          side.appendChild(h);
        }
        const b = document.createElement('button');
        b.className = 'kb-item';
        b.dataset.id = a.id;
        b.innerHTML = a.title + '<small>' + a.lede.slice(0, 26) + '…</small>' +
          (this.progress.data.read[a.id] ? '<span class="kb-tick">✓</span>' : '');
        side.appendChild(b);
      });
      side.addEventListener('click', e => {
        const b = e.target.closest('.kb-item');
        if (b) this.showArticle(b.dataset.id);
      });
      this.showArticle(articleId || C3D.ARTICLES[0].id);
    },

    showArticle(id) {
      const a = C3D.ARTICLES.find(x => x.id === id) || C3D.ARTICLES[0];
      if (this.progress.read(a.id)) this.updateProgressChip();
      this.markKB();
      $$('#kb-side .kb-item').forEach(b => b.classList.toggle('active', b.dataset.id === a.id));
      const main = $('#kb-main');
      main.innerHTML =
        '<h3>' + a.title + '</h3>' +
        '<p class="kb-lede">' + a.lede + '</p>' +
        a.body.map(p => '<p>' + p + '</p>').join('') +
        '<div class="kb-facts"><h4>关键事实</h4><ul>' +
        a.facts.map(f => '<li>' + f + '</li>').join('') + '</ul></div>';
      main.scrollTop = 0;
    },

    /* ---------------- 尺度阶梯 ---------------- */
    openLadder() {
      this.openModal('尺度阶梯', '拖动滑杆 · 每一格是一个数量级');
      const body = $('#modal-body');
      const E0 = LADDER[0].e, E1 = LADDER[LADDER.length - 1].e;
      const ticks = [0, 2, 3, 5, 6, 7, 8, 9, 10, 12].map(i => {
        const pct = (LADDER[i].e - E0) / (E1 - E0) * 100;
        return '<span style="left:' + pct.toFixed(2) + '%">' + LADDER[i].name.replace('距离', '').replace('轨道', '') + '</span>';
      }).join('');
      body.innerHTML =
        '<div class="ladder">' +
        '<div class="ladder-read"><span class="ladder-pow" id="lad-pow">10<sup>0</sup></span><span class="ladder-unit">米</span></div>' +
        '<div class="ladder-obj" id="lad-obj">—</div>' +
        '<div class="ladder-light" id="lad-light">—</div>' +
        '<input type="range" id="lad-range" min="0" max="' + (LADDER.length - 1) + '" value="0" step="1">' +
        '<div class="ladder-ticks">' + ticks + '</div>' +
        '<div class="ladder-note" id="lad-note"></div>' +
        '</div>';

      const range = $('#lad-range');
      const fmtLight = m => {
        const s = m / 299792458;
        if (s < 1) return (s * 1000).toFixed(0) + ' 毫秒';
        if (s < 120) return s.toFixed(s < 10 ? 2 : 0) + ' 秒';
        if (s < 7200) return (s / 60).toFixed(1) + ' 分钟';
        if (s < 172800) return (s / 3600).toFixed(1) + ' 小时';
        if (s < 3.15e7) return (s / 86400).toFixed(1) + ' 天';
        if (s < 3.15e10) return (s / 3.15e7).toFixed(1) + ' 年';
        return (s / 3.15e7).toExponential(2).replace('e+', ' × 10^') + ' 年';
      };

      const apply = () => {
        const s = LADDER[+range.value];
        const size = Math.pow(10, s.e);
        $('#lad-pow').innerHTML = '10<sup>' + Math.floor(s.e) + '</sup>';
        $('#lad-obj').textContent = s.name;
        $('#lad-light').textContent = '光穿过这个尺度需要 ' + fmtLight(size);
        $('#lad-note').innerHTML = s.note;
      };
      range.addEventListener('input', apply);
      apply();
    },

    /* ---------------- 测验 ---------------- */
    openQuiz(list) {
      const order = list && list.length ? list.slice() : C3D.QUIZ.map((_, i) => i);
      this.openModal(list && list.length ? '复习错题' : '小测验', order.length + ' 道题 · 每题都有解析');
      this.quiz = { order: order, pos: 0, score: 0, answered: false, wrong: [] };
      this.renderQuiz();
    },

    renderQuiz() {
      const body = $('#modal-body');
      const q = this.quiz;
      const total = q.order.length;
      body.innerHTML = '<div class="quiz-wrap" id="quiz-wrap"></div>';
      const wrap = $('#quiz-wrap');

      if (q.pos >= total) {
        const pct = Math.round(q.score / total * 100);
        let title = '宇宙学徒', note = '刚起步，去知识库转一圈再来。';
        if (pct >= 85) { title = '星系导航员'; note = '你已经能分辨尺度、光谱和暗物质了。'; }
        else if (pct >= 60) { title = '恒星观察者'; note = '基础扎实，再补几篇短文就完美了。'; }
        this.progress.quiz(q.score, q.wrong.slice(), total);
        this.updateProgressChip();
        const best = this.progress.data.quizBest;
        const bestTxt = total >= C3D.QUIZ.length ? '历史最佳 ' + best + '/' + C3D.QUIZ.length : '本轮 ' + q.score + '/' + total;
        wrap.innerHTML =
          '<div class="quiz-result"><div class="big">' + q.score + '/' + total + '</div>' +
          '<h3>' + title + '</h3><p>' + note + '</p>' +
          '<p class="quiz-best">' + bestTxt + ' · 累计作答 ' + this.progress.data.quizTries + ' 次</p>' +
          '<div class="quiz-result-actions">' +
          '<button class="t-btn primary" id="quiz-again">再测一次</button>' +
          (q.wrong.length ? '<button class="t-btn" id="quiz-review">复习错题 · ' + q.wrong.length + '</button>' : '') +
          '<button class="t-btn" id="quiz-kb">去知识库</button></div></div>';
        $('#quiz-again').onclick = () => this.openQuiz();
        if ($('#quiz-review')) $('#quiz-review').onclick = () => this.openQuiz(q.wrong.slice());
        $('#quiz-kb').onclick = () => this.openKB();
        return;
      }

      const item = C3D.QUIZ[q.order[q.pos]];
      wrap.innerHTML =
        '<div class="quiz-progress"><span>第 ' + (q.pos + 1) + ' / ' + total + ' 题</span>' +
        '<div class="quiz-bar"><i style="width:' + (q.pos / total * 100) + '%"></i></div>' +
        '<span style="margin-left:auto">得分 ' + q.score + '</span></div>' +
        '<h3 class="quiz-q">' + item.q + '</h3>' +
        '<div class="quiz-opts" id="quiz-opts">' +
        item.opts.map((o, i) => '<button class="quiz-opt" data-i="' + i + '">' + o + '</button>').join('') +
        '</div><div id="quiz-fb"></div>' +
        '<div class="quiz-foot"><span class="quiz-score">' + '　' + '</span>' +
        '<button class="t-btn primary" id="quiz-next" style="visibility:hidden">下一题 →</button></div>';
      const opts = $$('#quiz-opts .quiz-opt');
      opts.forEach(b => {
        b.addEventListener('click', () => {
          if (q.answered) return;
          q.answered = true;
          const i = +b.dataset.i;
          opts.forEach((x, k) => {
            x.disabled = true;
            if (k === item.a) x.classList.add('correct');
            else if (k === i) x.classList.add('wrong');
          });
          if (i === item.a) q.score++;
          else q.wrong.push(q.order[q.pos]);
          $('#quiz-fb').innerHTML = '<div class="quiz-feedback"><b style="color:' +
            (i === item.a ? '#6ee7b7' : '#fca5a5') + '">' +
            (i === item.a ? '回答正确。' : '正确答案是「' + item.opts[item.a] + '」。') +
            '</b> ' + item.why + '</div>';
          const next = $('#quiz-next');
          next.style.visibility = 'visible';
          next.textContent = q.pos === total - 1 ? '查看结果 →' : '下一题 →';
          next.onclick = () => { q.pos++; q.answered = false; this.renderQuiz(); };
        });
      });
    },

    /* ---------------- 帮助 ---------------- */
    openHelp() {
      this.openModal('怎么玩', '操作方式 · 学习路径 · 快捷键');
      $('#modal-body').innerHTML =
        '<div class="help-body">' +
        '<h3>操作</h3><div class="help-grid">' +
        '<div class="help-cell"><b>旋转视角</b><span>按住左键拖拽；触屏单指拖动。</span></div>' +
        '<div class="help-cell"><b>缩放</b><span>滚轮或双指捏合；越靠近天体越清楚。</span></div>' +
        '<div class="help-cell"><b>平移</b><span>右键拖拽（或双指拖动），移动观察中心。</span></div>' +
        '<div class="help-cell"><b>查看资料</b><span>点击天体、左侧列表或屏幕上的标签。</span></div>' +
        '<div class="help-cell"><b>今晚的天空</b><span>在「星空」里点右上角「今晚」：按真实时间与城市还原此刻的星空、月亮相位和行星位置。</span></div>' +
        '<div class="help-cell"><b>星图缩放</b><span>星空里滚轮放大到 30° 以下会浮现亮星中文名；下方滑块调光污染等级。</span></div>' +
        '<div class="help-cell"><b>分享一张图</b><span>右上角 ⤴ 把当前画面导成 2400 px 的海报：带标题、关键数据和日期，可下载 JPG / PNG 或复制文案。</span></div>' +
        '</div>' +
        '<h3>推荐学习路径</h3>' +
        '<p>① 从「导览」开始，用 9 站走完太阳系，建立尺度感；② 打开「知识库」读《宇宙有多大》和《光年与回望时间》；' +
        '③ 切到银河系，找到「太阳系在这里」，理解我们在银盘中的位置；④ 去深空看黑洞与星系并合；⑤ 去「星空」点「今晚」，对比自己头顶的天空；⑥ 最后做一次测验。' +
        '想被真实尺度震一下：太阳系底部点「真实比例」，行星会缩回真正的尺寸——地球只有 0.2 像素。' +
        '⑥ 最后去「宇宙缩放」：滚轮会连续地把视野从 1.7 米拉到 930 亿光年，中间每一格都能停。</p>' +
        '<h3>快捷键</h3><div class="help-grid">' +
        '<div class="help-cell"><b><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd> <kbd>6</kbd></b><span>太阳系 / 恒星演化 / 银河系 / 深空 / 宇宙缩放 / 星空</span></div>' +
        '<div class="help-cell"><b><kbd>空格</kbd></b><span>暂停 / 继续（恒星演化里暂停演化，缩放里暂停推拉）</span></div>' +
        '<div class="help-cell"><b><kbd>L</kbd> <kbd>O</kbd></b><span>标签 / 轨道显示开关</span></div>' +
        '<div class="help-cell"><b><kbd>S</kbd> <kbd>P</kbd></b><span>真实比例 / 学习进度</span></div>' +
        '<div class="help-cell"><b><kbd>R</kbd> <kbd>Esc</kbd></b><span>重置视角 / 关闭弹窗</span></div>' +
        '<div class="help-cell"><b><kbd>K</kbd> <kbd>Q</kbd></b><span>知识库 / 测验</span></div>' +
        '<div class="help-cell"><b><kbd>←</kbd> <kbd>→</kbd></b><span>导览上一站 / 下一站</span></div>' +
        '</div>' +
        '<p style="color:#66758f;font-size:11.5px;margin-top:18px">所有天体均为程序化生成的教学示意，比例经过压缩以便观察；' +
        '数据来自 NASA、ESA 与 Planck 2018 等公开资料。</p>' +
        '</div>';
    },

    /* ---------------- 模态 ---------------- */
    openModal(title, sub) {
      $('#modal-title').textContent = title;
      $('#modal-sub').textContent = sub || '';
      $('#modal').classList.remove('hidden');
    },

    closeModal() {
      $('#modal').classList.add('hidden');
      $('#modal-body').innerHTML = '';
    },


    /* ---------------- 分享导出 ---------------- */
    openShare() {
      const self = this;
      this.openModal('分享一张图', '当前画面 + 标题与关键数据 · 导出 PNG');
      const body = $('#modal-body');
      body.innerHTML =
        '<div class="share-wrap">' +
          '<div class="share-stage" id="share-stage"><div class="share-loading">正在渲染 2400 px 长边的高清图…</div></div>' +
          '<div class="share-bar">' +
            '<button class="chip-btn" id="share-dl" disabled>下载图片 JPG</button>' +
            '<button class="chip-btn ghost" id="share-png" disabled>PNG 无损</button>' +
            '<button class="chip-btn ghost" id="share-copy" disabled>复制文案</button>' +
            '<span class="share-hint" id="share-hint">2× 分辨率 · 无外部依赖</span>' +
          '</div>' +
        '</div>';

      C3D.share.onReady = function (url, meta) {
        const stage = $('#share-stage');
        if (!stage) return;
        stage.innerHTML = '<img id="share-img" alt="分享图预览" src="' + url + '">';
        $('#share-dl').disabled = false;
        $('#share-png').disabled = false;
        $('#share-copy').disabled = false;
        const kb = Math.round((C3D.share.jpegURL || '').length * 0.75 / 1024);
        $('#share-hint').textContent = meta.cn + ' · ' + C3D.share.w + '×' + C3D.share.h + ' · JPG ≈ ' + kb + ' KB';
      };

      $('#share-dl').addEventListener('click', function () {
        const ok = C3D.share.download('jpg');
        self.showToast(ok ? '已开始下载 JPG' : '导出失败，请重试', 1800);
      });
      $('#share-png').addEventListener('click', function () {
        const ok = C3D.share.download('png');
        self.showToast(ok ? '已开始下载 PNG（较大）' : '导出失败，请重试', 1800);
      });
      $('#share-copy').addEventListener('click', function () {
        C3D.share.copyText().then(ok => {
          self.showToast(ok ? '文案已复制' : '复制失败，可手动截图', 1800);
        });
      });

      /* 先让弹窗稳定一帧，再开渲染，避免 modal 动画期间卡顿 */
      requestAnimationFrame(() => setTimeout(() => { try { C3D.share.render(); } catch (e) { console.error(e); } }, 40));
    },

    /* ---------------- 学习进度 ---------------- */
    updateProgressChip() {
      const n = this.progress.visitedCount();
      $('#prog-txt').textContent = n + '/' + TOTAL_DIVES;
      $('#btn-progress').title = '已探索 ' + n + '/' + TOTAL_DIVES + ' 个天体 · 已读 ' +
        this.progress.readCount() + '/' + C3D.ARTICLES.length + ' 篇';
    },

    markKB() {
      const d = this.progress.data.read;
      $$('#kb-side .kb-item').forEach(b => {
        let t = b.querySelector('.kb-tick');
        if (d[b.dataset.id]) {
          if (!t) { t = document.createElement('span'); t.className = 'kb-tick'; t.textContent = '✓'; b.appendChild(t); }
        } else if (t) t.remove();
      });
      const sub = $('#modal-sub');
      if (sub && $('#kb-side')) sub.textContent = '已读 ' + this.progress.readCount() + '/' + C3D.ARTICLES.length + ' 篇 · 从尺度到暗能量';
    },

    openProgress() {
      this.openModal('学习进度', '只保存在这台设备的浏览器里');
      const d = this.progress.data;
      const cell = (b, s) => '<div class="prog-cell"><b>' + b + '</b><span>' + s + '</span></div>';
      let html = '<div class="prog-grid">' +
        cell(this.progress.visitedCount() + '/' + TOTAL_DIVES, '已探索天体') +
        cell(this.progress.readCount() + '/' + C3D.ARTICLES.length, '已读文章') +
        cell(this.progress.tourCount() + '/' + Object.keys(C3D.TOURS).length, '走过的导览') +
        cell(d.quizBest + '/' + C3D.QUIZ.length, '测验最佳') + '</div>';

      const left = [];
      ['solar', 'stellar', 'galaxy', 'deep', 'zoom', 'starmap'].forEach(sc => {
        ORDER[sc].forEach(id => {
          if (!d.visited[id] && C3D.DATA[sc][id]) left.push({ sc: sc, id: id, cn: C3D.DATA[sc][id].cn });
        });
      });
      html += '<div class="prog-note">' +
        (left.length ? '还有 <b style="color:#cfe6ff">' + left.length + '</b> 个地方没去过，点一下直接飞过去：'
                     : TOTAL_DIVES + ' 个天体全部探索过了，去银河北极看看银盘吧。') + '</div>';
      html += '<div class="prog-list">' +
        left.map(x => '<button data-go="' + x.sc + ':' + x.id + '">' + x.cn + '</button>').join('') + '</div>';

      if (d.quizBest < C3D.QUIZ.length) {
        html += '<div class="prog-note">测验最佳 ' + d.quizBest + '/' + C3D.QUIZ.length +
          (d.wrong && d.wrong.length ? ' · 上次错了 ' + d.wrong.length + ' 题，可以只复习错题。' : '。') + '</div>';
      }
      html += '<div class="prog-actions">' +
        '<button class="t-btn primary" id="prog-today">今日一题</button>' +
        '<button class="t-btn" id="prog-kb">知识库</button>' +
        (d.wrong && d.wrong.length ? '<button class="t-btn" id="prog-wrong">复习错题</button>' : '') +
        '<button class="t-btn" id="prog-reset" style="margin-left:auto">清空进度</button></div>';

      const body = $('#modal-body');
      body.innerHTML = html;
      body.onclick = e => {
        const go = e.target.closest('[data-go]');
        if (go) {
          const parts = go.dataset.go.split(':');
          this.closeModal();
          if (this.scene !== parts[0]) this.switchScene(parts[0]);
          setTimeout(() => this.select(parts[1], { user: true, focus: true }), 60);
          return;
        }
        if (e.target.id === 'prog-today') {
          this.openQuiz([new Date().getDate() % C3D.QUIZ.length]);
        } else if (e.target.id === 'prog-kb') {
          this.openKB();
        } else if (e.target.id === 'prog-wrong') {
          this.openQuiz(this.progress.data.wrong.slice());
        } else if (e.target.id === 'prog-reset') {
          this.progress.reset();
          this.updateProgressChip();
          this.syncRail();
          this.openProgress();
          this.showToast('学习进度已清空', 1800);
        }
      };
    },

    /* ---------------- 真实比例 ---------------- */
    toggleScale(v) {
      if (this.scene !== 'solar') return;
      const api = this.C.active;
      const want = v === undefined ? !api.real : !!v;
      if (want === api.real) return;
      api.setRealScale(want);
      $('#tg-scale').classList.toggle('on', want);
      if (want) {
        this.showScaleNote();
        this.showToast('真实比例 · 用滚轮靠近地球看看', 3000);
      } else {
        this.hideScaleNote();
      }
    },

    showScaleNote() {
      $('#scale-note').classList.remove('hidden');
      this.updateScaleNote();
    },

    hideScaleNote() {
      $('#scale-note').classList.add('hidden');
    },

    updateScaleNote() {
      if (this.scene !== 'solar' || !this.C.active.realInfo) return;
      const i = this.C.active.realInfo();
      const px = i.px < 0.05 ? '不到 0.05' : i.px.toFixed(i.px < 1 ? 2 : 1);
      const au = i.au >= 10 ? i.au.toFixed(0) : i.au.toFixed(1);
      $('#sn-body').innerHTML =
        '太阳直径 139.2 万公里，地球只有 1.27 万公里。此刻地球在屏幕上约 <b>' + px +
        ' 像素</b>，你与太阳的距离是 <b>' + au + ' AU</b>。' +
        '你看到的空白，就是太阳系真正的样子。';
    },

    realAction(kind) {
      if (kind === 'off') { this.toggleScale(false); return; }
      this.C.active.realView(kind);
      setTimeout(() => this.updateScaleNote(), 1600);
    },

    /* ---------------- 其他 ---------------- */
    showToast(text, ms) {
      const t = $('#toast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => t.classList.remove('show'), ms || 2200);
    },

    toggleFull() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen && document.exitFullscreen();
      }
    },

    onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea';
      if (typing) return;

      if (e.key === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else if (this.tour) this.endTour();
        else if (!$('#info').classList.contains('hidden')) this.hideInfo();
        return;
      }
      if (!$('#modal').classList.contains('hidden')) return;

      if (e.key === '1') this.switchScene('solar');
      else if (e.key === '2') this.switchScene('stellar');
      else if (e.key === '3') this.switchScene('galaxy');
      else if (e.key === '4') this.switchScene('deep');
      else if (e.key === '5') this.switchScene('zoom');
      else if (e.key === '6') this.switchScene('starmap');
      else if (e.key === 'r' || e.key === 'R') this.reset();
      else if (e.key === 'l' || e.key === 'L') this.toggleLabels();
      else if (e.key === 'o' || e.key === 'O') this.toggleOrbits();
      else if (e.key === 's' || e.key === 'S') this.toggleScale();
      else if (e.key === 'p' || e.key === 'P') this.openProgress();
      else if (e.key === 'k' || e.key === 'K') this.openKB();
      else if (e.key === 'q' || e.key === 'Q') this.openQuiz();
      else if (e.key === '?' || e.key === '/') this.openHelp();
      else if (e.key === ' ' && this.scene === 'solar') {
        e.preventDefault();
        this.setSpeed(this.currentSpeed === 0 ? 8 : 0, true);
      } else if (e.key === ' ' && this.scene === 'stellar') {
        e.preventDefault();
        this.toggleStellarPlay();
      } else if (e.key === ' ' && this.scene === 'zoom') {
        e.preventDefault();
        this.toggleZoomPlay();
      } else if (e.key === 'ArrowRight' && this.tour) {
        this.tourStep(1);
      } else if (e.key === 'ArrowLeft' && this.tour) {
        this.tourStep(-1);
      }
    },

    tick() {
      this.updateDate(false);
      if (!$('#scale-note').classList.contains('hidden')) this.updateScaleNote();
      if (this.scene === 'stellar') {
        this.syncStellarPanel(false);
        this._hrT = (this._hrT || 0) + 1;
        if (this._hrT % 3 === 0) this.drawHR();
      }
      if (this.scene === 'zoom') this.syncZoomPanel(false);
      if (this.scene === 'starmap') this.syncSkyPanel(false);
    },

    /* ---------------- 星空 ---------------- */
    syncSkyPanel(force) {
      const a = this.C.active;
      if (!a || a.name !== 'starmap') return;
      const st = a.getState();
      const nm = ['0 级 · 极限暗夜', '1 级 · 乡村', '2 级 · 郊区', '3 级 · 小镇', '4 级 · 城市', '5 级 · 市中心'];
      const el = $('#sky-lp-v');
      if (el && (force || this._lpShown !== st.lp)) {
        this._lpShown = st.lp;
        el.textContent = nm[Math.max(0, Math.min(5, Math.round(st.lp)))] || '';
      }
      const f = Math.round(a.api_fov ? a.api_fov() : st.fov);
      const fd = $('#sky-fov');
      if (fd && (force || this._fovShown !== f)) { this._fovShown = f; fd.textContent = f + '°'; }
      const cur = st.selCons;
      if (cur && cur !== this.selected && C3D.DATA.starmap[cur]) {
        this.selected = cur;
        this.syncRail();
        this.updateProgressChip();
        if (this.progress.visit(cur)) this.updateProgressChip();
      }
    },

    /* ---------------- 观测模式：今晚的天空 ---------------- */
    toggleObs() {
      const sm = this.C.scenes.starmap;
      if (!sm) return;
      if (sm.obsState()) { this.exitObs(); return; }
      sm.setObsDate(Date.now());
      sm.setSite(this.obsSiteIdx || 0);
      sm.setObs(true);
      // 朝南、仰角 35° —— 中纬度最容易看到行星的方向
      // 朝南、仰角约 24°：相机在球内，φ = 90° + 24° = 1.99 rad
      this.C.rig.snap(new THREE.Vector3(0, 0, 0), 0.02, 0, 1.885);
      this.syncObs();
      this.showToast('天球已转到此刻此地的真实位置 · 拖动环视，南边最热闹', 3200);
    },

    exitObs() {
      const sm = this.C.scenes.starmap;
      if (!sm) return;
      sm.setObs(false);
      $('#obs-bar').classList.add('hidden');
      document.body.classList.remove('obs');
      $('#obs-btn').classList.remove('hidden');
      $('#obs-btn').classList.remove('active');
      $('#obs-exit').classList.add('hidden');
    },

    syncObs() {
      const sm = this.C.scenes.starmap;
      if (!sm || !sm.obsState || !sm.obsState()) return;
      const inf = sm.obsInfo();
      if (!inf) return;
      $('#obs-bar').classList.remove('hidden');
      document.body.classList.add('obs');
      $('#obs-btn').classList.add('hidden');
      $('#obs-exit').classList.remove('hidden');
      const d = inf.date, pad = n => String(n).padStart(2, '0');
      $('#obs-date').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      $('#obs-site').value = String(this.obsSiteIdx || 0);

      const ang = inf.moonAngle || 0, fr = inf.moonPhase || 0;
      const phase = ang < 12 || ang > 348 ? '新月' : ang < 78 ? '蛾眉月' : ang < 102 ? '上弦月' :
        ang < 168 ? '盈凸月' : ang < 192 ? '满月' : ang < 258 ? '亏凸月' : ang < 282 ? '下弦月' : '残月';
      const sunTxt = inf.sunAlt > 0
        ? '太阳 <b>' + inf.sunAlt.toFixed(0) + '°</b>（白天）'
        : '太阳 ' + inf.sunAlt.toFixed(0) + '°（夜）';
      const moonTxt = inf.moonAlt > 0
        ? '月亮 <b>' + inf.moonAlt.toFixed(0) + '°</b> ' + phase + ' ' + Math.round(fr * 100) + '%'
        : '月亮在地平线下';
      const vis = (inf.rows || []).filter(r => r.key !== 'Sun' && r.key !== 'Moon' && r.alt > 0).map(r => r.cn);
      const planetTxt = vis.length ? '可见 <b>' + vis.join('、') + '</b>' : '此刻没有行星在地平线上';
      $('#obs-meta').innerHTML = inf.site.cn + ' · 北纬 ' + inf.site.lat.toFixed(1) + '° · ' +
        sunTxt + ' · ' + moonTxt + '<br>' + planetTxt;
    },

    /* ---------------- 宇宙缩放 ---------------- */
    toggleZoomPlay() {
      const a = this.C.active;
      if (!a || !a.togglePlay) return;
      const p = a.togglePlay();
      this.syncZoomPanel(true);
      this.showToast(p ? '继续放大视野' : '已暂停', 1200);
    },

    syncZoomPanel(force) {
      const a = this.C.active;
      if (!a || !a.getState) return;
      const st = a.getState();
      const sl = $('#zp-slider');
      const r = a.dexRange || [0, 27];
      const f = (st.dex - r[0]) / (r[1] - r[0]);
      if (sl) {
        const want = String(Math.round(f * 1000));
        if ((document.activeElement !== sl && sl.value !== want) || force) sl.value = want;
      }
      const btn = $('#zp-play');
      if (btn) {
        btn.classList.toggle('playing', !!st.playing);
        btn.textContent = st.playing ? '❙❙' : '▶';
      }
      const cur = a.currentInfo ? a.currentInfo() : null;
      if (cur) {
        const nm = $('#zp-name');
        if (nm) nm.textContent = cur.name;
        const dx = $('#zp-dex');
        if (dx) dx.textContent = cur.size;
        if (st.current !== this._zoomIdx) {
          this._zoomIdx = st.current;
          const id = ORDER.zoom[st.current];
          if (id && id !== this.selected) {
            this.selected = id;
            this.syncRail();
            if (this.progress && this.progress.visit(id)) this.updateProgressChip();
            this.renderInfo(a.info());
          }
        }
      }
    },

    /* ---------------- 恒星演化 ---------------- */
    toggleStellarPlay() {
      const p = this.C.active.togglePlay();
      this.syncStellarPanel(true);
      this.showToast(p ? '演化继续' : '已暂停', 1200);
    },

    syncStellarPanel(force) {
      const a = this.C.active;
      if (!a || !a.getState) return;
      const st = a.getState();
      const sl = $('#st-slider');
      if (sl && document.activeElement !== sl) sl.value = String(Math.round(st.progress * 1000));
      else if (sl && force) sl.value = String(Math.round(st.progress * 1000));
      const btn = $('#st-play');
      if (btn) {
        btn.classList.toggle('playing', !!st.playing);
        btn.textContent = st.playing ? '❙❙' : '▶';
      }
      const info = a.info ? a.info() : null;
      if (!info) return;
      const nm = $('#st-stage');
      if (nm) {
        nm.textContent = info.cn;
        nm.classList.toggle('trans', /正在转变/.test(info.cn));
      }
      if (this._stageName !== info.cn && !this.hideInfo._keep) {
        this._stageName = info.cn;
        if (!document.getElementById('info').classList.contains('hidden')) this.renderInfo(info);
      }
      const dur = $('#st-dur');
      if (dur) {
        const f = (info.facts && info.facts[0]) || '';
        dur.textContent = f.replace('当前阶段持续：', '');
      }
    },

    drawHR() {
      const a = this.C.active;
      if (!a || !a.hrData) return;
      const cv = $('#hr');
      if (!cv) return;
      const d = a.hrData();
      const W = cv.width, H = cv.height;
      const ctx = cv.getContext('2d');
      const L = 54, R = 14, T = 16, B = 34;
      const X0 = L, X1 = W - R, Y0 = T, Y1 = H - B;
      const TMAX = 4.62, TMIN = 3.34;   // log10 温度
      const LMAX = 7.0, LMIN = -4.0;    // log10 光度
      const px = t => X0 + (TMAX - Math.log10(Math.max(t, 1))) / (TMAX - TMIN) * (X1 - X0);
      const py = l => Y0 + (LMAX - Math.log10(Math.max(l, 1e-9))) / (LMAX - LMIN) * (Y1 - Y0);

      ctx.clearRect(0, 0, W, H);
      // 背景
      const bg = ctx.createLinearGradient(0, Y0, 0, Y1);
      bg.addColorStop(0, 'rgba(12,20,38,0.9)');
      bg.addColorStop(1, 'rgba(6,10,20,0.9)');
      ctx.fillStyle = bg;
      ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);

      // 网格
      ctx.strokeStyle = 'rgba(150,180,230,0.09)';
      ctx.lineWidth = 1;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(147,164,194,0.75)';
      ctx.textAlign = 'center';
      [30000, 10000, 6000, 3000].forEach(t => {
        const x = px(t);
        ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y1); ctx.stroke();
        ctx.fillText(t >= 10000 ? (t / 1000) + 'k' : String(t), x, H - 12);
      });
      ctx.textAlign = 'right';
      [6, 4, 2, 0, -2, -4].forEach(l => {
        const y = py(Math.pow(10, l));
        ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
        ctx.fillText('10' + ({ 6: '⁶', 4: '⁴', 2: '²', 0: '⁰', '-2': '⁻²', '-4': '⁻⁴' }[l]), X0 - 7, y + 3.5);
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(147,164,194,0.6)';
      ctx.fillText('温度 (K) →', X0, H - 12 + 0.5);
      ctx.save();
      ctx.translate(13, (Y0 + Y1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('光度 (L☉)', 0, 0);
      ctx.restore();

      // 主序带
      ctx.save();
      ctx.beginPath();
      const ms = [];
      for (let i = 0; i <= 90; i++) {
        const m = Math.pow(10, -1 + i / 90 * 2.6);   // 0.1 → 40
        const Rr = m < 1 ? Math.pow(m, 0.9) : Math.pow(m, 0.57);
        const Ll = m < 0.43 ? 0.23 * Math.pow(m, 2.3) : Math.pow(m, 3.5);
        const Tt = 5772 * Math.pow(Ll / (Rr * Rr), 0.25);
        ms.push([px(Tt), py(Math.max(Ll, 1e-6))]);
      }
      ctx.moveTo(ms[0][0], ms[0][1]);
      ms.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.strokeStyle = 'rgba(125,211,252,0.55)';
      ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      // 巨星支 / 超巨星区 / 白矮星区
      const band = (pts, fill, stroke) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
      };
      // 巨星支
      band([[px(5200), py(40)], [px(4200), py(300)], [px(3200), py(3000)],
            [px(3000), py(3000)], [px(3000), py(60)], [px(4400), py(30)]],
        'rgba(251,146,60,0.14)', 'rgba(251,146,60,0.34)');
      // 超巨星
      band([[px(30000), py(200000)], [px(3000), py(200000)], [px(3000), py(4000)], [px(30000), py(20000)]],
        'rgba(168,85,247,0.12)', 'rgba(168,85,247,0.3)');
      // 白矮星
      band([[px(100000), py(0.05)], [px(6000), py(0.01)], [px(6000), py(0.0001)], [px(100000), py(0.0001)]],
        'rgba(226,232,240,0.16)', 'rgba(226,232,240,0.34)');

      ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillStyle = 'rgba(125,211,252,0.75)';
      ctx.fillText('主序星', px(7000) - 16, py(30) - 8);
      ctx.fillStyle = 'rgba(251,146,60,0.8)';
      ctx.fillText('巨星', px(3600) - 46, py(700));
      ctx.fillStyle = 'rgba(192,132,252,0.85)';
      ctx.fillText('超巨星', px(9000), py(90000));
      ctx.fillStyle = 'rgba(226,232,240,0.7)';
      ctx.fillText('白矮星', px(20000), py(0.006) - 8);

      // 演化轨迹
      const pts = d.stages.map(s => [px(Math.max(s.T, 1000)), py(Math.max(s.L, 1e-6))]);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const a0 = pts[i - 1], b0 = pts[i];
        ctx.quadraticCurveTo(a0[0], b0[1], b0[0], b0[1]);
      }
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(251,191,36,0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2, 0, TAU);
        ctx.fillStyle = 'rgba(251,191,36,0.55)';
        ctx.fill();
      });

      // 当前位置
      const cx = px(d.cur.T), cy = py(d.cur.L);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.35, 'rgba(255,236,180,0.55)');
      grd.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, TAU);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
  };

  C3D.UI = UI;
})();
