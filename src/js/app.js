/* ============================================================
   COSMOS 3D — 启动
   ============================================================ */
(function () {
  const canvas = document.getElementById('stage');
  const labelLayer = document.getElementById('labels');

  function fail(msg) {
    const load = document.getElementById('loading');
    if (load) {
      load.innerHTML = '<div class="load-inner"><b>COSMOS 3D</b>' +
        '<small style="line-height:1.8;max-width:340px;display:block;letter-spacing:0;color:#93a4c2">' +
        msg + '</small></div>';
    }
  }

  let Core;
  try {
    Core = C3D.Core;
    Core.init(canvas, labelLayer);
  } catch (err) {
    console.error(err);
    fail('你的浏览器没能创建 WebGL 上下文。请换用较新的 Chrome / Safari / Edge，或在系统设置中开启硬件加速。<br><br>' + String(err && err.message || err));
    return;
  }

  // 构建三个场景
  try {
    const solar = C3D.buildSolar(Core);
    const galaxy = C3D.buildGalaxy(Core);
    const deep = C3D.buildDeep(Core);
    const stellar = C3D.buildStellar(Core);
    const zoom = C3D.buildZoom(Core);
  const starmap = C3D.buildStarmap(Core);
    Core.addScene('solar', solar);
    Core.addScene('stellar', stellar);
    Core.addScene('galaxy', galaxy);
    Core.addScene('deep', deep);
    Core.addScene('zoom', zoom);
  Core.addScene('starmap', starmap);
  } catch (err) {
    console.error(err);
    fail('场景构建失败：' + String(err && err.message || err));
    return;
  }

  C3D.UI.init(Core);

  // 日期等轻量 UI 状态
  setInterval(function () { C3D.UI.tick(); }, 200);

  // 首帧后淡出加载页
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      setTimeout(function () {
        const load = document.getElementById('loading');
        if (load) load.classList.add('done');
      }, 420);
    });
  });

  // 浏览器前进/后退
  window.addEventListener('hashchange', function () {
    const name = (location.hash || '').replace('#', '');
    if (C3D.UI && name && name !== C3D.UI.scene && C3D.UI.switchScene) {
      C3D.UI.switchScene(name, true);
    }
  });

  // 诊断模式：?diag=1 时把运行状态写入 DOM，便于自动化检查
  if (location.search.indexOf('diag') >= 0) {
    var lastT = performance.now(), lastE = 0;
    setInterval(function () {
      try {
        const a = Core.active;
        const info = {
          scene: Core.activeName,
          errs: window.__errs.slice(0, 8),
          radius: Core.rig ? +Core.rig.radius.toFixed(1) : null,
          objects: a ? (a.scene.children ? a.scene.children.length : 0) : 0,
          fps: 0,
          labels: Core.labels ? Core.labels.length : 0,
          selected: a ? a.selectedId : null,
          date: a && a.dateLabel ? a.dateLabel() : null
        };
        document.body.setAttribute('data-diag', JSON.stringify(info));
      } catch (e) { document.body.setAttribute('data-diag', 'diag-error:' + e.message); }
    }, 1000);
  }

  // 记录一次会话（仅本地），方便后续个性化提示
  try {
    const k = 'cosmos3d.visits';
    localStorage.setItem(k, String((+localStorage.getItem(k) || 0) + 1));
  } catch (e) {}
})();
