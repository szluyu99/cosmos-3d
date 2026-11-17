/* ============================================================
   COSMOS 3D — 学习进度（本地存储，不上传）
   ============================================================ */
(function () {
  const KEY = 'cosmos3d.learn.v1';
  const blank = () => ({
    visited: {},        // id -> 时间戳
    read: {},           // 文章 id
    tours: {},          // scene -> 已完成站数
    quizBest: 0,
    quizTries: 0,
    wrong: []           // 最近一次答错的题号
  });

  const P = {
    data: blank(),

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          this.data = Object.assign(blank(), d, {
            visited: d.visited || {},
            read: d.read || {},
            tours: d.tours || {},
            wrong: Array.isArray(d.wrong) ? d.wrong : []
          });
        }
      } catch (e) { this.data = blank(); }
      return this.data;
    },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
    },

    visit(id) {
      if (!id) return false;
      if (this.data.visited[id]) return false;
      this.data.visited[id] = Date.now();
      this.save();
      return true;
    },

    read(id) {
      if (!id || this.data.read[id]) return false;
      this.data.read[id] = Date.now();
      this.save();
      return true;
    },

    tour(scene, stops) {
      if (!scene) return;
      const cur = this.data.tours[scene] || 0;
      if (stops > cur) this.data.tours[scene] = stops;
      this.save();
    },

    quiz(score, wrong, total) {
      const FULL = (C3D.QUIZ && C3D.QUIZ.length) || 7;
      this.data.quizTries++;
      if (!total || total >= FULL) {
        if (score > this.data.quizBest) this.data.quizBest = score;
        this.data.wrong = wrong || [];
      }
      this.save();
    },

    reset() {
      this.data = blank();
      this.save();
    },

    visitedCount() { return Object.keys(this.data.visited).length; },
    readCount() { return Object.keys(this.data.read).length; },
    tourCount() { return Object.keys(this.data.tours).length; }
  };

  C3D.Progress = P;
})();
