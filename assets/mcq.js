// OB Notes: MCQ engine
// Owner (unlocked with passcode) gets practice mode: tick answers, green/red feedback, live score, retry.
// Everyone else gets the answer-key view: questions with the correct answer marked.
// Note: this is a static site, so the lock keeps casual visitors in view mode; it is not real security.
(function () {
  var OWNER_HASH = "50985636f8ccba926350d74f9e16bb35fc6cb4e40c2f96e68982ced11da4c7a9";
  var OWNER_KEY = "ob-owner";
  var data = window.MCQ;
  if (!data) return;
  var QS = data.questions.map(function (q, i) { q.id = i; return q; });
  var STORE = "ob-mcq-" + data.id;
  var LETTERS = ["A", "B", "C", "D", "E"];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffled(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }

  async function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return null;
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function isOwner() { return lsGet(OWNER_KEY) === OWNER_HASH; }

  // ---------- state (practice mode) ----------
  var state;
  function freshState(qids, shuffleOn) {
    var order = shuffleOn ? shuffled(qids) : qids.slice();
    var optOrder = {};
    order.forEach(function (id) { optOrder[id] = shuffled(range(QS[id].o.length)); });
    return { order: order, optOrder: optOrder, answers: {}, shuffle: !!shuffleOn, best: state ? state.best : null, keyView: false };
  }
  function load() {
    var raw = lsGet(STORE);
    if (raw) { try { var s = JSON.parse(raw); if (s && s.order && s.order.every(function (id) { return QS[id]; })) return s; } catch (e) {} }
    return null;
  }
  function save() { lsSet(STORE, JSON.stringify(state)); }

  // ---------- render ----------
  var app = document.getElementById("mcqApp");
  var topics = [];
  QS.forEach(function (q) { if (topics.indexOf(q.t) < 0) topics.push(q.t); });

  function topicId(t) { return "t-" + topics.indexOf(t); }

  function chipsHTML() {
    return '<div class="mcq-chips">' + topics.map(function (t) {
      var n = QS.filter(function (q) { return q.t === t; }).length;
      return '<a href="#' + topicId(t) + '">' + esc(t) + ' <span>' + n + '</span></a>';
    }).join("") + "</div>";
  }

  function questionHTML(q, num, practice) {
    var ans = practice ? state.answers[q.id] : undefined;
    var answered = ans !== undefined;
    var order = practice ? state.optOrder[q.id] : range(q.o.length);
    var cls = "mcq-q";
    if (practice && answered) cls += ans === q.a ? " is-right" : " is-wrong";
    var h = '<article class="' + cls + '" data-q="' + q.id + '">';
    h += '<div class="mcq-qhead"><span class="mcq-num">Q' + num + '</span>';
    if (practice && answered) h += ans === q.a ? '<span class="mcq-tag ok">✓ Correct</span>' : '<span class="mcq-tag bad">✗ Wrong</span>';
    h += "</div><p class=\"mcq-text\">" + esc(q.q) + "</p><div class=\"mcq-opts\">";
    order.forEach(function (oi, pos) {
      var c = "mcq-opt";
      var mark = "";
      if (!practice) { if (oi === q.a) { c += " right"; mark = "✓"; } else c += " dim"; }
      else if (answered) {
        if (oi === q.a) { c += " right"; mark = "✓"; }
        else if (oi === ans) { c += " wrong"; mark = "✗"; }
        else c += " dim";
      }
      var tag = practice && !answered ? "button" : "div";
      h += "<" + tag + ' class="' + c + '"' + (tag === "button" ? ' type="button" data-o="' + oi + '"' : "") + ">";
      h += '<span class="mcq-letter">' + LETTERS[pos] + '</span><span class="mcq-otext">' + esc(q.o[oi]) + '</span><span class="mcq-mark">' + mark + "</span></" + tag + ">";
    });
    h += "</div>";
    if (!practice || answered) h += '<div class="mcq-exp"><b>Why:</b> ' + esc(q.e) + "</div>";
    return h + "</article>";
  }

  function scoreNums() {
    var answered = 0, right = 0;
    state.order.forEach(function (id) { var a = state.answers[id]; if (a !== undefined) { answered++; if (a === QS[id].a) right++; } });
    return { answered: answered, right: right, wrong: answered - right, total: state.order.length };
  }

  function renderOwner() {
    var s = scoreNums();
    var pct = s.total ? Math.round((s.answered / s.total) * 100) : 0;
    var wrongIds = state.order.filter(function (id) { var a = state.answers[id]; return a !== undefined && a !== QS[id].a; });
    var h = '<div class="mcq-bar"><div class="mcq-bar-in">';
    h += '<div class="mcq-score"><span class="big">' + s.right + '</span> / ' + s.answered + ' answered <span class="sep">·</span> <span class="ok">' + s.right + ' right</span> <span class="bad">' + s.wrong + ' wrong</span> <span class="sep">·</span> Total ' + s.total + (state.order.length < QS.length ? " (retry set)" : "") + "</div>";
    h += '<div class="mcq-actions">';
    h += '<button type="button" class="mcq-btn" data-act="restart">↻ Restart all</button>';
    h += '<button type="button" class="mcq-btn" data-act="wrong"' + (wrongIds.length ? "" : " disabled") + ">Retry wrong (" + wrongIds.length + ")</button>";
    h += '<label class="mcq-toggle"><input type="checkbox" data-act="shuffle"' + (state.shuffle ? " checked" : "") + "> Shuffle</label>";
    h += '<button type="button" class="mcq-btn ghost" data-act="key">Answer key</button>';
    h += '<button type="button" class="mcq-btn ghost" data-act="lock" title="Leave owner mode on this device">🔓 Lock</button>';
    h += "</div></div><div class=\"mcq-progress\"><i style=\"width:" + pct + '%"></i></div></div>';

    if (s.answered === s.total && s.total > 0) {
      var p = Math.round((s.right / s.total) * 100);
      if (state.order.length === QS.length && (state.best === null || p > state.best)) { state.best = p; save(); }
      h += '<div class="mcq-result"><div class="mcq-result-big">' + s.right + " / " + s.total + " <small>(" + p + "%)</small></div>";
      h += "<p>" + (p >= 85 ? "Excellent. You know this PDF." : p >= 65 ? "Good. Retry the wrong ones once more." : "Read the notes for the red topics, then retry.") + (state.best !== null ? " Best full-set score: " + state.best + "%." : "") + "</p>";
      h += '<div class="mcq-actions"><button type="button" class="mcq-btn" data-act="restart">↻ Restart all</button>' + (wrongIds.length ? '<button type="button" class="mcq-btn" data-act="wrong">Retry wrong (' + wrongIds.length + ")</button>" : "") + "</div></div>";
    }

    var list = "";
    if (state.shuffle || state.order.length < QS.length) {
      state.order.forEach(function (id, i) { list += questionHTML(QS[id], i + 1, true); });
    } else {
      var n = 0;
      topics.forEach(function (t) {
        list += '<h2 class="mcq-topic" id="' + topicId(t) + '">' + esc(t) + "</h2>";
        state.order.forEach(function (id) { if (QS[id].t === t) { n++; list += questionHTML(QS[id], n, true); } });
      });
    }
    app.innerHTML = h + (state.shuffle || state.order.length < QS.length ? "" : chipsHTML()) + list;
  }

  function renderKey(ownerViewing) {
    var h = '<div class="mcq-bar"><div class="mcq-bar-in"><div class="mcq-score">📖 Answer key · ' + QS.length + " questions. Correct answers are marked in green.</div>";
    h += '<div class="mcq-actions">';
    if (ownerViewing) h += '<button type="button" class="mcq-btn" data-act="practice">← Back to practice</button>';
    else h += '<button type="button" class="mcq-btn ghost" data-act="unlock">🔒 Owner login</button>';
    h += "</div></div></div>" + chipsHTML();
    var n = 0;
    topics.forEach(function (t) {
      h += '<h2 class="mcq-topic" id="' + topicId(t) + '">' + esc(t) + "</h2>";
      QS.forEach(function (q) { if (q.t === t) { n++; h += questionHTML(q, n, false); } });
    });
    app.innerHTML = h;
  }

  function render() {
    if (isOwner()) { if (!state) state = load() || freshState(range(QS.length), false); if (state.keyView) renderKey(true); else renderOwner(); }
    else renderKey(false);
  }

  // ---------- unlock modal ----------
  function openModal() {
    var m = document.getElementById("mcqModal");
    m.hidden = false;
    var inp = m.querySelector("input");
    inp.value = ""; m.querySelector(".mcq-modal-err").textContent = "";
    setTimeout(function () { inp.focus(); }, 30);
  }
  function closeModal() { document.getElementById("mcqModal").hidden = true; }
  async function tryUnlock(pass) {
    var h = await sha256(pass.trim());
    if (h === null) return "This browser can't verify the passcode here.";
    if (h !== OWNER_HASH) return "Wrong passcode.";
    lsSet(OWNER_KEY, h);
    return "";
  }

  // ---------- events ----------
  app.addEventListener("click", function (ev) {
    var opt = ev.target.closest("button.mcq-opt");
    if (opt && isOwner()) {
      var qEl = opt.closest(".mcq-q");
      var qid = +qEl.getAttribute("data-q");
      if (state.answers[qid] !== undefined) return;
      state.answers[qid] = +opt.getAttribute("data-o");
      save();
      var y = qEl.getBoundingClientRect().top;
      render();
      var again = app.querySelector('.mcq-q[data-q="' + qid + '"]');
      if (again) window.scrollBy(0, again.getBoundingClientRect().top - y);
      return;
    }
    var btn = ev.target.closest("[data-act]");
    if (!btn || btn.tagName === "INPUT") return;
    var act = btn.getAttribute("data-act");
    if (act === "unlock") return openModal();
    if (act === "restart") { state = freshState(range(QS.length), state.shuffle); save(); render(); window.scrollTo({ top: 0 }); }
    if (act === "wrong") {
      var w = state.order.filter(function (id) { var a = state.answers[id]; return a !== undefined && a !== QS[id].a; });
      if (w.length) { state = freshState(w, state.shuffle); save(); render(); window.scrollTo({ top: 0 }); }
    }
    if (act === "key") { state.keyView = true; save(); render(); window.scrollTo({ top: 0 }); }
    if (act === "practice") { state.keyView = false; save(); render(); window.scrollTo({ top: 0 }); }
    if (act === "lock") { lsDel(OWNER_KEY); state = null; render(); window.scrollTo({ top: 0 }); }
  });
  app.addEventListener("change", function (ev) {
    if (ev.target.getAttribute("data-act") === "shuffle") {
      var ids = state.order.length < QS.length ? state.order : range(QS.length);
      state = freshState(ids, ev.target.checked); save(); render();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    var m = document.getElementById("mcqModal");
    m.querySelector("form").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var err = await tryUnlock(m.querySelector("input").value);
      if (err) { m.querySelector(".mcq-modal-err").textContent = err; return; }
      closeModal(); render();
    });
    m.querySelector("[data-close]").addEventListener("click", closeModal);
    m.addEventListener("click", function (ev) { if (ev.target === m) closeModal(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeModal(); });
  });

  // One-time unlock link: page.html#unlock=PASSCODE
  (async function () {
    var mm = location.hash.match(/^#unlock=(.+)$/);
    if (mm) {
      await tryUnlock(decodeURIComponent(mm[1]));
      history.replaceState(null, "", location.pathname + location.search);
    }
    render();
  })();
})();
