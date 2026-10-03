/* app.js — every drawing on the page. Each toy draws only while on screen. */
(function () {
  "use strict";
  var U = window.UI || {}, TH = U.lang === "th";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CARD = /[?&]card/.test(location.search);
  var QT = (location.search.match(/[?&]t=([\d.]+)/) || [])[1];
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2;
  var GOLD = "#f2c14e", GOLD2 = "#ffe39a", BLUE = "#8fd3ff", NIGHT = "#0a0f1f";
  function fmt(n, d) { d = d || 0; return n.toLocaleString(TH ? "th-TH" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function sci(n) {
    if (n < 1e5) return fmt(n, n < 10 ? 2 : 0);
    var e = Math.floor(Math.log10(n)), m = n / Math.pow(10, e);
    return fmt(m, 1) + " × 10" + String(e).split("").map(function (c) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]; }).join("");
  }
  function fit(cv, maxD) {
    var d = Math.min(window.devicePixelRatio || 1, maxD || 2), w = cv.clientWidth, h = cv.clientHeight;
    var W = Math.max(1, Math.round(w * d)), H = Math.max(1, Math.round(h * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    return { x: x, w: w, h: h, d: d };
  }
  function press(b, on) { if (b) b.setAttribute("aria-pressed", on ? "true" : "false"); }
  function range(id, show, cb) {
    var el = $(id), out = $(id + "v");
    function go(user) { var v = parseFloat(el.value); if (out) out.textContent = show ? show(v) : v; if (cb) cb(v, user); }
    el.addEventListener("input", function () { go(true); });
    go(false);
    return { el: el, get: function () { return parseFloat(el.value); } };
  }
  function set(id, t) { var e = $(id); if (e) e.textContent = t; }
  function rnd(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

  var toys = [];
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { toys.forEach(function (t) { if (t.el === e.target) t.vis = e.isIntersecting; }); });
  }, { rootMargin: "120px" }) : null;
  function toy(el, frame) { var t = { el: el, frame: frame, vis: !io }; toys.push(t); if (io) io.observe(el); return t; }
  var last = 0;
  function loop(ts) {
    var dt = Math.min(64, ts - (last || ts)); last = ts;
    requestAnimationFrame(loop);
    if (!document.hidden) toys.forEach(function (t) { if (t.vis) { try { t.frame(ts, dt); } catch (e) { if (!t.err) { t.err = 1; console.error(t.el.id, e); } } } });
  }

  /* ---------- lightning by midpoint displacement, for the hero and strikes ---------- */
  function bolt(ax, ay, bx, by, rough, depth, r, out, w) {
    out = out || []; w = w || 3;
    if (depth <= 0) { out.push([ax, ay, bx, by, w]); return out; }
    var mx = (ax + bx) / 2, my = (ay + by) / 2, L = Math.hypot(bx - ax, by - ay);
    var nx = -(by - ay) / (L || 1), ny = (bx - ax) / (L || 1), off = (r() - 0.5) * L * rough;
    mx += nx * off; my += ny * off;
    bolt(ax, ay, mx, my, rough, depth - 1, r, out, w);
    bolt(mx, my, bx, by, rough, depth - 1, r, out, w);
    if (depth > 2 && r() < 0.32) {
      var a = Math.atan2(by - my, bx - mx) + (r() - 0.5) * 1.4, l = L * (0.3 + r() * 0.35);
      bolt(mx, my, mx + Math.cos(a) * l, my + Math.sin(a) * l, rough, depth - 2, r, out, w * 0.45);
    }
    return out;
  }
  function drawBolt(x, segs, a, col) {
    x.lineCap = "round";
    [[7, 0.12], [3, 0.35], [1, 1]].forEach(function (p) {
      x.strokeStyle = col || "rgba(220,235,255," + (p[1] * a) + ")";
      if (col) x.globalAlpha = p[1] * a;
      [3, 1.5, 0.7].forEach(function (wb) {
        x.lineWidth = wb * p[0] * 0.5; x.beginPath();
        segs.forEach(function (s) { if ((s[4] > 2 ? 3 : s[4] > 1 ? 1.5 : 0.7) === wb) { x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); } });
        x.stroke();
      });
    });
    x.globalAlpha = 1;
  }

  /* ---------- the vajra, a 3-D wireframe computed from curves ---------- */
  function prongR(s) { return (0.17 + 1.0 * s) * Math.pow(1 - s, 1.2); }
  function vajraModel(n) {
    // returns list of polylines: {pts:[[x,y,z]...], w:width, kind}
    var L = [], outer = n > 1 ? n - 1 : 0, j, k, s;
    for (var side = -1; side <= 1; side += 2) {
      // rings: neck and lotus, as circles of revolution
      [[0.15, 0.085], [0.19, 0.1], [0.23, 0.13], [0.27, 0.165], [0.31, 0.185], [0.35, 0.19], [0.39, 0.18], [0.42, 0.17]].forEach(function (rr) {
        var pts = []; for (j = 0; j <= 36; j++) { var a = j / 36 * TAU; pts.push([side * rr[0], Math.cos(a) * rr[1], Math.sin(a) * rr[1]]); }
        L.push({ pts: pts, w: 1.1, kind: "ring" });
      });
      // lotus petals
      for (k = 0; k < 8; k++) {
        var pts2 = [], a0 = k / 8 * TAU;
        for (j = 0; j <= 12; j++) { s = j / 12; var xx = 0.22 + s * 0.2, rr2 = 0.12 + 0.07 * Math.sin(s * Math.PI * 0.9), aa = a0 + 0.18 * Math.sin(s * Math.PI); pts2.push([side * xx, Math.cos(aa) * rr2, Math.sin(aa) * rr2]); }
        L.push({ pts: pts2, w: 1, kind: "petal" });
      }
      // central prong
      var c = []; for (j = 0; j <= 10; j++) { s = j / 10; c.push([side * (0.42 + 0.6 * s), 0, 0]); }
      L.push({ pts: c, w: 3.2, kind: "prong", taper: true });
      // outer prongs, one curve copied around the shaft every 360/outer degrees
      for (k = 0; k < outer; k++) {
        var ph = k / outer * TAU, p = [];
        for (j = 0; j <= 24; j++) { s = j / 24; var r = prongR(s) * (n === 2 ? 0.8 : 1); p.push([side * (0.42 + 0.58 * s), Math.cos(ph) * r, Math.sin(ph) * r]); }
        L.push({ pts: p, w: 2.6, kind: "prong", taper: true });
      }
    }
    return L;
  }
  function drawVajra(x, cx, cy, S, n, spin, yaw, roll, glow) {
    var model = vajraModel(n), cs = Math.cos(spin), sn = Math.sin(spin), cy_ = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
    function P(p) {
      var y = p[1] * cs - p[2] * sn, z = p[1] * sn + p[2] * cs, X = p[0] * cy_ + z * sy, Z = -p[0] * sy + z * cy_;
      var f = 3.2 / (3.2 - Z), u = X * S * f, v = -y * S * f;
      return [cx + u * cr - v * sr, cy + u * sr + v * cr, Z];
    }
    var lines = model.map(function (m) { var q = m.pts.map(P), z = 0; q.forEach(function (t) { z += t[2]; }); return { q: q, z: z / q.length, m: m }; });
    lines.sort(function (a, b) { return a.z - b.z; });
    x.lineCap = "round"; x.lineJoin = "round";
    if (glow) {
      var o = P([0, 0, 0]), hr = S * 1.1, hg = x.createRadialGradient(o[0], o[1], 0, o[0], o[1], hr);
      hg.addColorStop(0, "rgba(255,210,110," + 0.35 * glow + ")"); hg.addColorStop(1, "rgba(255,210,110,0)");
      x.fillStyle = hg; x.fillRect(o[0] - hr, o[1] - hr, 2 * hr, 2 * hr);
    }
    lines.forEach(function (l) {
      var lit = 0.55 + 0.45 * Math.max(-1, Math.min(1, l.z * 3)), i;
      x.strokeStyle = l.m.kind === "prong" ? "rgba(" + Math.round(200 + 55 * lit) + "," + Math.round(150 + 70 * lit) + "," + Math.round(50 + 60 * lit) + ",1)" : "rgba(242,193,78," + (0.35 + 0.5 * lit) + ")";
      if (!l.m.taper) {
        x.lineWidth = l.m.w * (S / 200); x.beginPath(); x.moveTo(l.q[0][0], l.q[0][1]);
        for (i = 1; i < l.q.length; i++) x.lineTo(l.q[i][0], l.q[i][1]);
        x.stroke(); return;
      }
      for (var seg = 0; seg < 4; seg++) {     // a tapering prong in four strokes
        var a0 = Math.floor(seg * (l.q.length - 1) / 4), a1 = Math.floor((seg + 1) * (l.q.length - 1) / 4);
        x.lineWidth = l.m.w * (S / 200) * (1.25 - 0.95 * (seg + 0.5) / 4);
        x.beginPath(); x.moveTo(l.q[a0][0], l.q[a0][1]);
        for (i = a0 + 1; i <= a1; i++) x.lineTo(l.q[i][0], l.q[i][1]);
        x.stroke();
      }
    });
    // the hard ball in the middle
    var c0 = P([0, 0, 0]), R = 0.12 * S;
    var g = x.createRadialGradient(c0[0] - R * 0.35, c0[1] - R * 0.4, R * 0.1, c0[0], c0[1], R);
    g.addColorStop(0, "#fff4c8"); g.addColorStop(0.5, GOLD); g.addColorStop(1, "#8a5a12");
    x.fillStyle = g; x.beginPath(); x.arc(c0[0], c0[1], R, 0, TAU); x.fill();
    return [P([1.02, 0, 0]), P([-1.02, 0, 0])];
  }

  /* ---------- hero: vajra in a storm ---------- */
  (function () {
    var cv = $("scene"); if (!cv) return;
    var r = rnd(7), strikes = [], next = 900, t0 = QT ? parseFloat(QT) * 1000 : 0, clouds = [];
    for (var i = 0; i < 26; i++) clouds.push([r(), r() * 0.45, 0.08 + r() * 0.18, r()]);
    if (CARD) { var rr = rnd(42); strikes.push({ segs: null, seed: 11, x: 0.83, age: 60, life: 400 }); strikes.push({ segs: null, seed: 5, x: 0.6, age: 120, life: 400 }); }
    toy(cv, function (ts, dt) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h, t = (QT || CARD) ? t0 : ts;
      var flash = 0;
      strikes.forEach(function (s) { var k = 1 - s.age / s.life; if (k > 0) flash = Math.max(flash, k * k * 0.5); });
      var bg = x.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgb(" + Math.round(10 + 60 * flash) + "," + Math.round(14 + 70 * flash) + "," + Math.round(34 + 90 * flash) + ")");
      bg.addColorStop(1, "#05070f");
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      clouds.forEach(function (c) {
        var cx = ((c[0] + t * 0.000004 * (0.5 + c[3])) % 1.2 - 0.1) * w, cy = c[1] * h, R = c[2] * Math.max(w, h);
        var g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, "rgba(" + Math.round(60 + 120 * flash) + "," + Math.round(70 + 120 * flash) + "," + Math.round(100 + 120 * flash) + ",0.30)");
        g.addColorStop(1, "rgba(20,30,60,0)");
        x.fillStyle = g; x.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      });
      if (!RM && !CARD && !QT) {
        next -= dt;
        if (next < 0) { strikes.push({ seed: (Math.random() * 1e9) | 0, x: 0.45 + Math.random() * 0.5, age: 0, life: 420 + Math.random() * 300 }); next = 1800 + Math.random() * 3200; }
      }
      strikes.forEach(function (s) {
        if (!s.segs) { var q = rnd(s.seed); s.segs = bolt(s.x * w, -10, (s.x + (q() - 0.5) * 0.2) * w, h + 10, 0.42, 8, q, null, 2.6); }
        var k = Math.max(0, 1 - s.age / s.life), fl = k > 0.85 || (k > 0.55 && k < 0.65) ? 1 : k;
        drawBolt(x, s.segs, fl);
        if (!CARD && !QT) s.age += dt;
      });
      strikes = strikes.filter(function (s) { return s.age < s.life; });
      var S = Math.min(w * 0.36, h * 0.52) * (CARD ? 0.8 : 1), spin = RM ? 0.6 : t * 0.00045, cx = w * (CARD ? 0.76 : w > 760 ? 0.68 : 0.5), cy = h * (CARD ? 0.66 : w > 760 ? 0.56 : 0.66);
      drawVajra(x, cx, cy, S, 5, spin, 0.35 + 0.12 * Math.sin(t * 0.0003), -0.5, 0.35 + flash);
    });
  })();

  /* ---------- vajra toy ---------- */
  (function () {
    var cv = $("vjcv"); if (!cv) return;
    var spin = 0.4, on = !RM, n = 5, strike = 0, segs = [], drag = null, yaw = 0.55;
    var pr = range("vprong", function (v) { return fmt(v); }, function (v) {
      n = v | 0;
      set("vsym", n > 1 ? fmt(360 / (n - 1), n - 1 === 7 ? 1 : 0) + "°" : "—");
      var curves = 2 * (8 + 8 + 1 + Math.max(0, n - 1));
      set("vcurves", fmt(curves)); set("vends", fmt(2));
    });
    $("vspin").addEventListener("click", function () { on = !on; press(this, on); });
    press($("vspin"), on);
    $("vstrike").addEventListener("click", function () { strike = 1; segs = null; });
    cv.addEventListener("pointerdown", function (e) { drag = [e.clientX, e.clientY, spin, yaw]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", function (e) { if (!drag) return; spin = drag[2] + (e.clientY - drag[1]) * 0.012; yaw = drag[3] + (e.clientX - drag[0]) * 0.006; });
    cv.addEventListener("pointerup", function () { drag = null; });
    toy(cv, function (ts, dt) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h;
      if (on && !drag) spin += dt * 0.0008;
      x.fillStyle = strike > 0.6 ? "#3a4a78" : NIGHT; x.fillRect(0, 0, w, h);
      var tips = drawVajra(x, w / 2, h / 2, Math.min(w * 0.4, h * 0.66), n, spin, yaw, -0.32, strike * 0.8);
      if (strike > 0) {
        if (!segs) { var q = rnd((Math.random() * 1e9) | 0); segs = bolt(tips[0][0], tips[0][1], w + 20, Math.random() * h, 0.4, 6, q, null, 2).concat(bolt(tips[1][0], tips[1][1], -20, Math.random() * h, 0.4, 6, q, null, 2)); }
        drawBolt(x, segs, strike);
        strike -= dt / 700;
      }
    });
  })();

  /* ---------- bell with inharmonic partials ---------- */
  (function () {
    var cv = $("bellcv"); if (!cv) return;
    var RAT = [1, 2.71, 5.13, 8.21], AMP = [1, 0.6, 0.38, 0.22], DEC = [6, 4, 2.4, 1.5], hit = -1e9, ac = null;
    function ring() {
      hit = performance.now();
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        var t = ac.currentTime, out = ac.createGain(); out.gain.value = 0.16; out.connect(ac.destination);
        RAT.forEach(function (r, i) {
          [1, 1.0023].forEach(function (det) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.frequency.value = 523 * r * det; o.type = "sine";
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(AMP[i] * 0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + DEC[i]);
            o.connect(g); g.connect(out); o.start(t); o.stop(t + DEC[i] + 0.1);
          });
        });
      } catch (e) { /* no audio, drawing still runs */ }
    }
    $("bring").addEventListener("click", ring);
    cv.addEventListener("click", ring);
    toy(cv, function (ts) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h, el = (ts - hit) / 1000;
      x.fillStyle = NIGHT; x.fillRect(0, 0, w, h);
      var amp = RAT.map(function (r, i) { return el >= 0 ? AMP[i] * Math.exp(-el * 4.6 / DEC[i]) : 0; });
      // the bell: a profile curve, wobbling in its (2,0) mode
      var bx = w * 0.27, by = h * 0.18, bh = h * 0.5, bw = Math.min(w * 0.2, h * 0.36), wob = amp[0] * 0.06 * Math.sin(ts * 0.02);
      x.beginPath();
      for (var j = 0; j <= 60; j++) { var s = j / 60, r = bw * (0.35 + 0.65 * Math.pow(s, 1.6)) * (1 + wob * Math.cos(s * 3)); x.lineTo(bx - r, by + 40 + s * bh); }
      for (j = 60; j >= 0; j--) { s = j / 60; r = bw * (0.35 + 0.65 * Math.pow(s, 1.6)) * (1 - wob * Math.cos(s * 3)); x.lineTo(bx + r, by + 40 + s * bh); }
      x.closePath();
      var g = x.createLinearGradient(bx - bw, 0, bx + bw, 0); g.addColorStop(0, "#7a5418"); g.addColorStop(0.45, GOLD2); g.addColorStop(1, "#6a4510");
      x.fillStyle = g; x.fill();
      x.strokeStyle = GOLD; x.lineWidth = 2; x.beginPath(); x.ellipse(bx, by + 40 + bh, bw, bw * 0.16, 0, 0, TAU); x.stroke();
      drawVajra(x, bx, by + 12, bw * 0.38, 5, 0.6, 0, -Math.PI / 2, 0);
      // the partials as waves, right side
      var wx = w * 0.5, ww = w * 0.46, rowH = h / 5.2, total = [];
      x.font = "13px system-ui"; x.textBaseline = "middle";
      RAT.forEach(function (r, i) {
        var cy = rowH * (i + 0.7);
        x.fillStyle = "rgba(174,184,204,.8)"; x.fillText("×" + fmt(r, 2), wx, cy - rowH * 0.32);
        x.strokeStyle = "hsla(" + (45 + i * 40) + ",90%,70%," + (0.25 + amp[i]) + ")"; x.lineWidth = 1.6; x.beginPath();
        for (var k = 0; k <= 200; k++) { var tt = k / 200, y = Math.sin(tt * TAU * 3 * r + ts * 0.004 * r) * amp[i] * rowH * 0.4; x.lineTo(wx + tt * ww, cy + y); total[k] = (total[k] || 0) + y; }
        x.stroke();
      });
      var cy2 = rowH * 4.75; x.strokeStyle = BLUE; x.lineWidth = 2.2; x.beginPath();
      for (var k = 0; k <= 200; k++) x.lineTo(wx + k / 200 * ww, cy2 + (total[k] || 0) * 0.45);
      x.stroke();
      x.fillStyle = "rgba(174,184,204,.8)"; x.fillText("Σ", wx - 16, cy2);
    });
  })();

  /* ---------- the dielectric breakdown model ---------- */
  (function () {
    var cv = $("boltcv"); if (!cv) return;
    var GW = 96, GH = 72, phi, cl, par, cand, order, eta = 1, done = false, flash = 0, path = null, steps = 0, running = false;
    function idx(i, j) { return j * GW + i; }
    function reset() {
      phi = new Float32Array(GW * GH); cl = new Uint8Array(GW * GH); par = new Int32Array(GW * GH).fill(-1);
      for (var j = 0; j < GH; j++) for (var i = 0; i < GW; i++) phi[idx(i, j)] = j / (GH - 1);
      order = []; cand = new Set(); done = false; path = null; steps = 0; flash = 0;
      add(idx(GW >> 1, 0), -1);
      for (var k = 0; k < 60; k++) relax();
      running = true;
    }
    function add(c, p) {
      cl[c] = 1; phi[c] = 0; par[c] = p; order.push(c); cand.delete(c);
      var i = c % GW, j = (c / GW) | 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var a = i + d[0], b = j + d[1];
        if (a >= 0 && a < GW && b >= 0 && b < GH - 1 && !cl[idx(a, b)]) cand.add(idx(a, b));
      });
    }
    function relax() {
      for (var j = 1; j < GH - 1; j++) for (var i = 0; i < GW; i++) {
        var c = idx(i, j); if (cl[c]) continue;
        var l = i > 0 ? phi[c - 1] : phi[c + 1], r = i < GW - 1 ? phi[c + 1] : phi[c - 1];
        var v = (l + r + phi[c - GW] + phi[c + GW]) / 4;
        phi[c] += 1.75 * (v - phi[c]);
      }
    }
    function step() {
      var tot = 0, ws = [], cs = [];
      cand.forEach(function (c) { var v = Math.pow(Math.max(phi[c], 1e-6), eta); ws.push(v); cs.push(c); tot += v; });
      var r = Math.random() * tot, k = 0;
      for (; k < ws.length - 1; k++) { r -= ws[k]; if (r <= 0) break; }
      var c = cs[k], i = c % GW, j = (c / GW) | 0, p = -1;
      [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(function (d) { var a = i + d[0], b = j + d[1]; if (p < 0 && a >= 0 && a < GW && b >= 0 && cl[idx(a, b)]) p = idx(a, b); });
      add(c, p); steps++;
      if (j >= GH - 2) { done = true; running = false; flash = 1; path = []; var q = c; while (q >= 0) { path.push(q); q = par[q]; } stats(); }
      relax(); relax();
    }
    function stats() {
      set("lsteps", fmt(steps));
      var kids = new Uint8Array(GW * GH); order.forEach(function (c) { if (par[c] >= 0) kids[par[c]] = 1; });
      var tips = 0; order.forEach(function (c) { if (!kids[c]) tips++; }); set("ltips", fmt(tips));
      if (order.length < 40) { set("ldim", "–"); return; }
      var xs = [], ys = [];
      [1, 2, 4, 8].forEach(function (s) {
        var B = new Set(); order.forEach(function (c) { B.add(((c % GW) / s | 0) + "," + (((c / GW) | 0) / s | 0)); });
        xs.push(Math.log(1 / s)); ys.push(Math.log(B.size));
      });
      var mx = xs.reduce(function (a, b) { return a + b; }) / 4, my = ys.reduce(function (a, b) { return a + b; }) / 4, num = 0, den = 0;
      for (var i = 0; i < 4; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
      set("ldim", fmt(num / den, 2));
    }
    range("leta", function (v) { return fmt(v, 1); }, function (v, user) { eta = v; if (user) reset(); });
    $("lgrow").addEventListener("click", reset);
    reset();
    toy(cv, function (ts, dt) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h, sx = w / GW, sy = h / GH;
      if (running) { for (var k = 0; k < (RM ? 40 : 9); k++) if (running) step(); if (steps % 8 === 0) stats(); }
      x.fillStyle = flash > 0 ? "rgba(" + Math.round(10 + 120 * flash) + "," + Math.round(15 + 130 * flash) + "," + Math.round(31 + 160 * flash) + ",1)" : NIGHT;
      x.fillRect(0, 0, w, h);
      x.fillStyle = "#1d2b1a"; x.fillRect(0, h - sy, w, sy);
      x.lineCap = "round";
      x.strokeStyle = "rgba(190,215,255,0.75)"; x.lineWidth = Math.max(1, sx * 0.35); x.beginPath();
      order.forEach(function (c) { var p = par[c]; if (p < 0) return; x.moveTo((p % GW + 0.5) * sx, ((p / GW | 0) + 0.5) * sy); x.lineTo((c % GW + 0.5) * sx, ((c / GW | 0) + 0.5) * sy); });
      x.stroke();
      if (path) {
        [[sx * 1.6, "rgba(160,200,255,0.25)"], [sx * 0.7, "#ffffff"]].forEach(function (s) {
          x.strokeStyle = s[1]; x.lineWidth = s[0]; x.beginPath();
          x.moveTo((path[0] % GW + 0.5) * sx, h);
          path.forEach(function (c) { x.lineTo((c % GW + 0.5) * sx, ((c / GW | 0) + 0.5) * sy); });
          x.stroke();
        });
      }
      if (flash > 0) flash = Math.max(0, flash - dt / 600);
    });
  })();

  /* ---------- Mekhala and Ramasun: light now, sound later ---------- */
  (function () {
    var cv = $("mekcv"); if (!cv) return;
    var d = 5, t0 = -1, segs = null, heard = false, tap0 = -1, MAXKM = 20;
    range("mdist", function (v) { return fmt(v, 1) + " " + U.km; }, function (v) {
      d = v; set("mlight", fmt(v / 299792.458 * 1e6, 1) + " " + U.us); set("mdelay", fmt(v * 1000 / 343, 1) + " " + U.s); set("mkm", fmt(v, 1) + " " + U.km);
    });
    $("mflash").addEventListener("click", function () { t0 = performance.now(); segs = null; heard = false; });
    $("mtap").addEventListener("click", function () {
      var now = performance.now();
      if (tap0 < 0) { tap0 = now; this.textContent = U.m_tap2; set("mtd", "…"); set("mtk", "…"); }
      else { var s = (now - tap0) / 1000; tap0 = -1; this.textContent = U.m_tap1; set("mtd", fmt(s, 1) + " " + U.s); set("mtk", fmt(s * 0.343, 1) + " " + U.km + " · " + fmt(s * 0.343 / 1.609, 1) + " " + U.mi); }
    });
    toy(cv, function (ts) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h, gy = h * 0.82, ox = w * 0.07, sxk = (w * 0.88) / MAXKM, strikeX = ox + d * sxk;
      var el = t0 < 0 ? -1 : (ts - t0) / 1000, fl = el >= 0 && el < 0.35 ? 1 - el / 0.35 : 0;
      var sky = x.createLinearGradient(0, 0, 0, gy);
      sky.addColorStop(0, "rgb(" + Math.round(16 + 120 * fl) + "," + Math.round(20 + 120 * fl) + "," + Math.round(44 + 140 * fl) + ")"); sky.addColorStop(1, "#1a2440");
      x.fillStyle = sky; x.fillRect(0, 0, w, gy);
      x.fillStyle = "#14200f"; x.fillRect(0, gy, w, h - gy);
      // km ticks
      x.fillStyle = "rgba(174,184,204,.75)"; x.font = "12px system-ui"; x.textAlign = "center";
      for (var k = 0; k <= MAXKM; k += 2) { var X = ox + k * sxk; x.fillRect(X, gy, 1, 6); x.fillText(fmt(k) + (k ? "" : " " + U.km), X, gy + 18); }
      // clouds
      for (var c = 0; c < 9; c++) { var cx = (c / 8) * w, R = h * (0.16 + 0.05 * Math.sin(c * 2.3)); var g = x.createRadialGradient(cx, h * 0.1, 0, cx, h * 0.1, R); g.addColorStop(0, "rgba(90,100,140,.55)"); g.addColorStop(1, "rgba(40,50,80,0)"); x.fillStyle = g; x.fillRect(cx - R, h * 0.1 - R, R * 2, R * 2); }
      // the listener's house
      x.fillStyle = "#c9b48a"; x.fillRect(ox - 12, gy - 18, 24, 18); x.beginPath(); x.moveTo(ox - 16, gy - 18); x.lineTo(ox, gy - 32); x.lineTo(ox + 16, gy - 18); x.fill();
      // Mekhala's jewel and Ramasun's axe up in the cloud over the strike
      var jy = h * 0.2, jx = strikeX - 26, jr = 10 + 12 * fl + 2 * Math.sin(ts * 0.004);
      var jg = x.createRadialGradient(jx, jy, 0, jx, jy, jr * 3); jg.addColorStop(0, "rgba(255,255,240,1)"); jg.addColorStop(0.3, "rgba(170,230,255,.8)"); jg.addColorStop(1, "rgba(120,200,255,0)");
      x.fillStyle = jg; x.beginPath(); x.arc(jx, jy, jr * 3, 0, TAU); x.fill();
      var ang = el >= 0 && el < 0.6 ? el * 14 : 0.8, ax = strikeX + 26, ay = jy + 4;
      x.save(); x.translate(ax, ay); x.rotate(ang); x.strokeStyle = "#8a6a3a"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 12); x.lineTo(0, -14); x.stroke();
      x.fillStyle = "#cfd8e8"; x.beginPath(); x.moveTo(0, -14); x.quadraticCurveTo(14, -18, 14, -6); x.lineTo(0, -6); x.fill(); x.restore();
      x.font = "13px system-ui"; x.fillStyle = "rgba(242,239,230,.85)"; x.textAlign = "right"; x.fillText(U.m_mek, jx - 18, jy - 18); x.textAlign = "left"; x.fillText(U.m_ram, ax + 14, ay - 22); x.textAlign = "center"; x.fillText(U.m_you, ox, gy - 40);
      if (el >= 0) {
        if (!segs) segs = bolt(strikeX, jy + 10, strikeX + (Math.random() - 0.5) * 30, gy, 0.4, 7, rnd((Math.random() * 1e9) | 0), null, 2.4);
        if (el < 0.5) drawBolt(x, segs, el < 0.12 || (el > 0.2 && el < 0.3) ? 1 : 0.5);
        var rpx = el * 0.343 * sxk;
        if (rpx < w * 1.5) { x.strokeStyle = "rgba(242,193,78," + Math.max(0.15, 0.8 - rpx / w) + ")"; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.arc(strikeX, gy, rpx, Math.PI, TAU); x.stroke(); x.setLineDash([]); }
        if (!heard && strikeX - rpx <= ox) { heard = true; }
        x.textAlign = "left"; x.font = "bold 22px Fraunces, 'Noto Serif Thai', serif"; x.fillStyle = GOLD;
        var secs = heard ? d / 0.343 : el;
        x.fillText(fmt(secs, 1) + " " + U.s, ox + 22, gy - 40);
        if (heard && el - d / 0.343 < 1.2) { x.font = "bold 30px Fraunces, serif"; x.fillStyle = "rgba(255,240,200," + (1 - (el - d / 0.343) / 1.2) + ")"; x.fillText("BOOM", ox - 10, gy - 70); }
      }
    });
  })();

  /* ---------- Widmanstätten: bands from the faces of an octahedron ---------- */
  (function () {
    var cv = $("widcv"); if (!cv) return;
    var ni = 10.8, ang = 30, dirty = true, img = null, N = 280;
    function verdict() {
      var v = ni < 4 ? U.x_earth : ni < 5 ? U.x_odd : U.x_sky;
      set("xverdict", v);
      var wmm = ni >= 6 && ni <= 16 ? 3.3 * Math.exp(-(ni - 6) * 0.29) : 0;
      set("xbands", wmm ? "≈ " + fmt(wmm, 2) + " mm" : ni < 4 ? "—" : ni < 6 ? U.x_hexa : U.x_atax);
    }
    range("xni", function (v) { return fmt(v, 1) + "%"; }, function (v) { ni = v; dirty = true; verdict(); });
    range("xang", function (v) { return fmt(v) + "°"; }, function (v) { ang = v; dirty = true; });
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function render() {
      var a = ang * Math.PI / 180, s3 = 1 / Math.sqrt(3);
      var n = norm([s3 * Math.cos(a), s3 * Math.cos(a), s3 * Math.cos(a) + Math.sin(a)]);
      var e1 = norm(cross(n, [1, -1, 0])), e2 = cross(n, e1);
      var fams = [];
      [[1, 1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].forEach(function (m) {
        var t = cross(n, norm(m)), tl = Math.hypot(t[0], t[1], t[2]);
        if (tl < 0.12) return;            // this face lies in the slice; its bands vanish
        var dx = dot(t, e1) / tl, dy = dot(t, e2) / tl; fams.push([-dy, dx, tl]);
      });
      var r = rnd(99), seeds = [];
      for (var i = 0; i < 46; i++) seeds.push([r() * N, r() * N, (r() * fams.length) | 0, r()]);
      var data = new ImageData(N, N), D = data.data;
      var wpx = ni >= 6 && ni <= 16 ? 3 + 20 * Math.exp(-(ni - 6) * 0.29) : 0;
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var best = 1e9, sb = 0, b2 = 1e9;
        for (var k = 0; k < seeds.length; k++) { var dd = (x - seeds[k][0]) * (x - seeds[k][0]) + (y - seeds[k][1]) * (y - seeds[k][1]); if (dd < best) { b2 = best; best = dd; sb = k; } else if (dd < b2) b2 = dd; }
        var v, o = (y * N + x) * 4, noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        if (ni < 4) {            // smelted iron: grey with slag streaks
          v = 120 + 30 * Math.sin(x * 0.05 + Math.sin(y * 0.11) * 2) + 25 * noise; if (Math.sin(y * 0.09 + x * 0.01) > 0.96) v -= 70;
        } else if (wpx === 0) {  // no bands: hexahedrite lines or ataxite grain
          v = 165 + 30 * noise; if (ni < 6) { var q = Math.abs(((x + y * 0.6) / 9) % 1 - 0.5); if (q < 0.03) v -= 60; q = Math.abs(((x * 0.4 - y) / 13) % 1 - 0.5); if (q < 0.025) v -= 50; } else v = 140 + 18 * noise;
        } else {
          var f = fams[seeds[sb][2]], u = (x * f[0] + y * f[1]) / (wpx * (0.6 + 0.6 * f[2])) + seeds[sb][3] * 3, fr = u - Math.floor(u);
          v = fr < 0.72 ? 190 + 25 * Math.sin(u * 0.7 + seeds[sb][3] * 9) : fr < 0.78 || fr > 0.96 ? 70 : 125 + 30 * noise;  // kamacite, taenite edge, plessite
          if (Math.sqrt(b2) - Math.sqrt(best) < 1.1) v = 95;
        }
        v = Math.max(0, Math.min(255, v));
        D[o] = v * 0.96; D[o + 1] = v * 0.97; D[o + 2] = v; D[o + 3] = 255;
      }
      var oc = document.createElement("canvas"); oc.width = oc.height = N; oc.getContext("2d").putImageData(data, 0, 0); img = oc;
    }
    toy(cv, function () {
      if (!dirty && cv._w === cv.clientWidth) return;
      if (dirty) render(); dirty = false; cv._w = cv.clientWidth;
      var F = fit(cv), x = F.x, w = F.w, h = F.h;
      x.fillStyle = "#e9e3d6"; x.fillRect(0, 0, w, h);
      x.save(); x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, -0.2, 0, TAU); x.clip();
      x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, w, h);
      var g = x.createRadialGradient(w * 0.35, h * 0.3, 0, w / 2, h / 2, w * 0.6); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.25)");
      x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
      x.strokeStyle = "#3b3a3a"; x.lineWidth = 3; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, -0.2, 0, TAU); x.stroke();
    });
  })();

  /* ---------- weapon shapes, shared by the sun lathe and the rack ---------- */
  function chakraPath(x, cx, cy, R, teeth, rot) {
    x.beginPath();
    var M = teeth * 12;
    for (var i = 0; i <= M; i++) {
      var a = i / M * TAU + rot, ph = (i % 12) / 12, r = R * (0.86 + 0.14 * Math.pow(1 - ph, 2.2));
      x.lineTo(cx + Math.cos(a + 0.12 * ph / teeth * 6) * r, cy + Math.sin(a + 0.12 * ph / teeth * 6) * r);
    }
    x.closePath();
  }
  function drawChakra(x, cx, cy, R, teeth, rot, col, frac) {
    frac = frac == null ? 1 : frac;
    x.save(); x.strokeStyle = col || GOLD; x.lineWidth = Math.max(1.2, R * 0.05);
    if (frac < 1) { x.setLineDash([frac * R * 40, R * 40]); }
    chakraPath(x, cx, cy, R, teeth, rot); x.stroke();
    x.setLineDash([]);
    if (frac >= 1) {
      x.beginPath(); x.arc(cx, cy, R * 0.68, 0, TAU); x.stroke();
      for (var k = 0; k < 8; k++) { var a = rot + k / 8 * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.18, cy + Math.sin(a) * R * 0.18); x.lineTo(cx + Math.cos(a) * R * 0.68, cy + Math.sin(a) * R * 0.68); x.stroke(); }
      x.beginPath(); x.arc(cx, cy, R * 0.18, 0, TAU); x.stroke();
    }
    x.restore();
  }
  function tridentPath(x, cx, cy, H) {
    var s = H / 100;
    x.beginPath();
    x.moveTo(cx, cy + 50 * s); x.lineTo(cx, cy - 34 * s);            // shaft
    x.moveTo(cx, cy - 56 * s); x.lineTo(cx - 5 * s, cy - 36 * s); x.lineTo(cx + 5 * s, cy - 36 * s); x.closePath(); // middle point
    x.moveTo(cx, cy - 26 * s);
    x.bezierCurveTo(cx - 22 * s, cy - 26 * s, cx - 24 * s, cy - 36 * s, cx - 22 * s, cy - 50 * s);   // left prong
    x.moveTo(cx, cy - 26 * s);
    x.bezierCurveTo(cx + 22 * s, cy - 26 * s, cx + 24 * s, cy - 36 * s, cx + 22 * s, cy - 50 * s);   // right prong
    x.moveTo(cx - 8 * s, cy - 22 * s); x.lineTo(cx + 8 * s, cy - 22 * s);
  }
  function drawTrident(x, cx, cy, H, col, frac) {
    x.save(); x.strokeStyle = col || GOLD; x.lineWidth = Math.max(1.4, H * 0.035); x.lineCap = "round"; x.lineJoin = "round";
    if (frac != null && frac < 1) x.setLineDash([frac * H * 3.2, H * 4]);
    tridentPath(x, cx, cy, H); x.stroke(); x.restore();
  }
  function drawPushpaka(x, cx, cy, S, col, frac) {
    x.save(); x.strokeStyle = col || GOLD; x.lineWidth = Math.max(1.2, S * 0.03); x.lineJoin = "round";
    if (frac != null && frac < 1) x.setLineDash([frac * S * 6, S * 8]);
    var s = S / 100; x.beginPath();
    x.moveTo(cx - 40 * s, cy + 10 * s); x.lineTo(cx + 40 * s, cy + 10 * s);       // platform
    x.moveTo(cx - 30 * s, cy + 10 * s); x.lineTo(cx - 30 * s, cy - 10 * s); x.lineTo(cx + 30 * s, cy - 10 * s); x.lineTo(cx + 30 * s, cy + 10 * s);
    x.moveTo(cx - 34 * s, cy - 10 * s); x.lineTo(cx - 18 * s, cy - 26 * s); x.lineTo(cx + 18 * s, cy - 26 * s); x.lineTo(cx + 34 * s, cy - 10 * s);
    x.moveTo(cx - 14 * s, cy - 26 * s); x.lineTo(cx, cy - 52 * s); x.lineTo(cx + 14 * s, cy - 26 * s);     // spire
    for (var k = -1; k <= 1; k++) { x.moveTo(cx + k * 30 * s, cy + 16 * s); x.quadraticCurveTo(cx + k * 30 * s + 10 * s, cy + 24 * s, cx + k * 30 * s + 20 * s, cy + 16 * s); } // clouds under
    x.stroke(); x.restore();
  }
  function drawSpear(x, cx, cy, H, col, frac) {
    x.save(); x.strokeStyle = col || GOLD; x.lineWidth = Math.max(1.2, H * 0.03); x.lineJoin = "round";
    if (frac != null && frac < 1) x.setLineDash([frac * H * 2.6, H * 3]);
    var s = H / 100; x.beginPath();
    x.moveTo(cx, cy + 50 * s); x.lineTo(cx, cy - 26 * s);
    x.moveTo(cx, cy - 56 * s); x.bezierCurveTo(cx - 12 * s, cy - 40 * s, cx - 10 * s, cy - 30 * s, cx, cy - 24 * s); x.bezierCurveTo(cx + 10 * s, cy - 30 * s, cx + 12 * s, cy - 40 * s, cx, cy - 56 * s);
    x.stroke(); x.restore();
  }

  /* ---------- the sun on Vishvakarma's lathe ---------- */
  (function () {
    var cv = $("suncv"); if (!cv) return;
    var ground = 0, teeth = 16, holding = false, sparks = [], rot = 0, refused = 0;
    var thingsAt = [0, 0.25, 0.5, 0.75];
    function readout() {
      var light = 1 - ground; set("slight", fmt(light * 100, 1) + "%"); set("srad", fmt(Math.sqrt(light) * 100, 1) + "%");
      var f = ground / 0.125, made = U.s_things.filter(function (_, i) { return f >= thingsAt[i] + 0.25 - 1e-9; });
      set("smade", made.length ? made.join(" · ") : "—");
    }
    range("steeth", function (v) { return fmt(v); }, function (v) { teeth = v | 0; });
    var b = $("sgrind");
    function down(e) { holding = true; e.preventDefault(); }
    function up() { holding = false; }
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up);
    b.addEventListener("click", function () { if (ground < 0.125) { ground = Math.min(0.125, ground + 0.004); readout(); } else refused = 1; });
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointerup", up);
    readout();
    toy(cv, function (ts, dt) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h;
      rot += dt * (0.0015 + (holding ? 0.004 : 0));
      if (holding) { if (ground < 0.125) { ground = Math.min(0.125, ground + dt * 0.000018); readout(); } else refused = 1; }
      x.fillStyle = "#16223a"; x.fillRect(0, 0, w, h);
      var sx = w * 0.19, sy = h * 0.5, R0 = Math.min(w * 0.13, h * 0.34), R = R0 * Math.sqrt(1 - ground);
      // lathe: bed, headstock, tailstock
      x.fillStyle = "#3a3f52"; x.fillRect(sx - R0 * 1.6, sy + R0 * 1.05, R0 * 3.2, R0 * 0.16);
      x.fillRect(sx - R0 * 1.55, sy - R0 * 0.3, R0 * 0.25, R0 * 1.35); x.fillRect(sx + R0 * 1.3, sy - R0 * 0.3, R0 * 0.25, R0 * 1.35);
      x.strokeStyle = "#8b93a8"; x.lineWidth = 4; x.beginPath(); x.moveTo(sx - R0 * 1.3, sy); x.lineTo(sx - R, sy); x.moveTo(sx + R, sy); x.lineTo(sx + R0 * 1.3, sy); x.stroke();
      // the sun, with turning granules
      var g = x.createRadialGradient(sx, sy, 0, sx, sy, R * 1.9);
      g.addColorStop(0, "rgba(255,240,180,1)"); g.addColorStop(R / (R * 1.9), "rgba(255,190,70,1)"); g.addColorStop(0.62, "rgba(255,160,40,.25)"); g.addColorStop(1, "rgba(255,140,30,0)");
      x.fillStyle = g; x.beginPath(); x.arc(sx, sy, R * 1.9, 0, TAU); x.fill();
      x.strokeStyle = "rgba(255,120,30,.35)"; x.lineWidth = 1.2;
      for (var k = 0; k < 18; k++) { var a = rot + k / 18 * TAU; x.beginPath(); x.arc(sx, sy, R * (0.3 + 0.6 * ((k * 7) % 10) / 10), a, a + 0.5); x.stroke(); }
      // the grinding tool
      var tx = sx + R * Math.cos(-0.5), ty = sy + R * Math.sin(-0.5) - 2;
      x.fillStyle = "#c9ced9"; x.beginPath(); x.moveTo(tx + 4, ty - 3); x.lineTo(tx + 50, ty - 30); x.lineTo(tx + 58, ty - 20); x.lineTo(tx + 8, ty + 4); x.fill();
      if (holding && ground < 0.125 && !RM) for (k = 0; k < 4; k++) sparks.push({ x: tx, y: ty, vx: 1.5 + Math.random() * 3, vy: -1.5 - Math.random() * 2.5, life: 1 });
      sparks.forEach(function (p) { p.x += p.vx * dt * 0.12; p.y += p.vy * dt * 0.12; p.vy += 0.004 * dt; p.life -= dt / 900; });
      sparks = sparks.filter(function (p) { return p.life > 0; });
      x.fillStyle = "#ffd36b"; sparks.forEach(function (p) { x.globalAlpha = p.life; x.fillRect(p.x, p.y, 2.2, 2.2); }); x.globalAlpha = 1;
      // what the dust becomes
      var f = ground / 0.125, slot = (w - (sx + R0 * 1.9)) / 4, base = sx + R0 * 1.9 + slot / 2, H = Math.min(slot * 1.2, h * 0.62);
      if (f >= 1 && w > 500) {
        var ex = base + slot * 1.5, er = Math.min(slot * 1.1, h * 0.32);
        drawChakra(x, ex, sy, er, teeth, rot * 0.6, GOLD);
        drawTrident(x, ex, sy + er * 0.05, er * 2.3, GOLD2);
      } else {
        var drawers = [function (fr) { drawChakra(x, base, sy, H * 0.42, teeth, rot * 0.6, GOLD, fr); }, function (fr) { drawTrident(x, base + slot, sy, H, GOLD, fr); },
          function (fr) { drawPushpaka(x, base + slot * 2, sy, H * 0.9, GOLD, fr); }, function (fr) { drawSpear(x, base + slot * 3, sy, H, GOLD, fr); }];
        drawers.forEach(function (fn, i) { var fr = Math.max(0, Math.min(1, (f - thingsAt[i]) / 0.25)); if (fr > 0) fn(fr); });
      }
      if (refused > 0) { x.fillStyle = "rgba(255,227,154," + refused + ")"; x.font = "bold 18px Fraunces, 'Noto Serif Thai', serif"; x.textAlign = "center"; x.fillText("⅛", sx, sy - R0 * 1.3); refused = Math.max(0, refused - dt / 1500); }
    });
  })();

  /* ---------- Brokkr's bellows, the fly and the short handle ---------- */
  (function () {
    var cv = $("forgecv"); if (!cv) return;
    var st, pump = false, b = $("fpump");
    function reset() { st = { heat: 30, work: 0, handle: 60, bites: 0, flinch: 0, fly: 0, nextBite: 2.5 + Math.random() * 2, done: false, throwT: -1, blink: 0 }; show(); }
    function show() { set("fhandle", fmt(st.handle, 1) + " " + U.cm); set("fheat", fmt(st.heat) + "%"); set("fbites", fmt(st.bites) + " / 3"); }
    function down(e) { pump = true; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { } }
    function up() { pump = false; }
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    b.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { pump = true; e.preventDefault(); } });
    b.addEventListener("keyup", function () { pump = false; });
    $("freset").addEventListener("click", reset);
    $("fthrow").addEventListener("click", function () { if (st.done) st.throwT = 0; });
    reset();
    toy(cv, function (ts, dt) {
      var F = fit(cv), x = F.x, w = F.w, h = F.h, s = dt / 1000;
      var working = pump && st.flinch <= 0 && !st.done;
      if (!st.done) {
        st.heat += (working ? 40 : -30) * s; st.heat = Math.max(0, Math.min(100, st.heat));
        if (st.work > 0 && !working) st.handle = Math.max(10, st.handle - 6 * s);
        if (working && st.heat > 50) st.work += 12 * s;
        if (st.work > 0 && st.bites < 3) { st.nextBite -= s; if (st.nextBite <= 0) { st.bites++; st.flinch = st.bites === 3 ? 0.7 : 0.35; st.blink = st.bites === 3 ? 0.7 : 0; st.nextBite = 2 + Math.random() * 2.5; } }
        if (st.flinch > 0) st.flinch -= s;
        if (st.blink > 0) st.blink -= s;
        if (st.work >= 100) { st.done = true; st.work = 100; }
        show();
      }
      x.fillStyle = NIGHT; x.fillRect(0, 0, w, h);
      var fx = w * 0.4, fy = h * 0.72, heat = st.heat / 100;
      // the fire: a sum of waving sines
      for (var k = 0; k < 7; k++) {
        x.fillStyle = "hsla(" + (20 + k * 6) + ",100%," + (40 + 25 * heat) + "%," + (0.18 + 0.1 * heat) + ")"; x.beginPath(); x.moveTo(fx - 70, fy);
        for (var i = 0; i <= 30; i++) { var u = i / 30, X = fx - 70 + u * 140, Y = fy - (40 + 90 * heat) * Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(ts * 0.006 + k * 1.7 + u * 7)); x.lineTo(X, Y); }
        x.fill();
      }
      x.fillStyle = "#2b2f3d"; x.fillRect(fx - 80, fy, 160, h - fy);
      // the bellows
      var bx = fx - 150, by = fy - 30, open = working ? 0.5 + 0.5 * Math.sin(ts * 0.02) : 0.85;
      x.fillStyle = "#6b4a2b"; x.beginPath(); x.moveTo(bx + 60, by); x.lineTo(bx - 10, by - 18 - 22 * open); x.lineTo(bx - 10, by + 18 + 22 * open); x.closePath(); x.fill();
      x.strokeStyle = "#a8865a"; x.lineWidth = 2; for (i = 1; i < 5; i++) { var q = i / 5; x.beginPath(); x.moveTo(bx - 10 + 70 * q, by - (18 + 22 * open) * (1 - q)); x.lineTo(bx - 10 + 70 * q, by + (18 + 22 * open) * (1 - q)); x.stroke(); }
      // the fly on a Lissajous path, landing on bite
      var lx = bx + 20 + 70 * Math.sin(ts * 0.0031), ly = by - 60 + 40 * Math.sin(ts * 0.0047 + 1);
      if (st.flinch > 0) { lx = bx - 14; ly = by - 30; }
      x.fillStyle = "#111"; x.beginPath(); x.ellipse(lx, ly, 5, 3.5, 0, 0, TAU); x.fill();
      x.fillStyle = "rgba(200,220,255,.6)"; x.beginPath(); x.ellipse(lx - 3, ly - 4, 4, 2, -0.6 + Math.sin(ts * 0.08) * 0.4, 0, TAU); x.ellipse(lx + 3, ly - 4, 4, 2, 0.6 - Math.sin(ts * 0.08) * 0.4, 0, TAU); x.fill();
      // the anvil and the hammer as it is made
      var ax = w * 0.8, ay = h * 0.7;
      x.fillStyle = "#4a5266"; x.beginPath(); x.moveTo(ax - 80, ay); x.lineTo(ax + 70, ay); x.quadraticCurveTo(ax + 100, ay - 5, ax + 110, ay - 22); x.lineTo(ax - 80, ay - 22); x.closePath(); x.fill(); x.fillRect(ax - 40, ay, 60, h * 0.22);
      var made = st.work / 100, hl = st.handle * (h / 260), glowc = "rgba(255," + Math.round(120 + 100 * (1 - made)) + ",60,";
      var hx = ax, hy = ay - 22, tt = st.throwT;
      if (tt >= 0) {
        st.throwT += s; var th = st.throwT / 1.8 * TAU;
        if (st.throwT > 1.8) st.throwT = -1;
        var rr = (h * 0.32) * (0.4 + Math.cos(th - Math.PI)) * 0.9;
        hx = ax + Math.cos(th - Math.PI / 2) * rr - 0; hy = ay - 22 - Math.abs(Math.sin(th / 2)) * h * 0.35;
        x.strokeStyle = "rgba(143,211,255,.25)"; x.lineWidth = 1.5; x.beginPath();
        for (i = 0; i <= 60; i++) { var t2 = i / 60 * TAU, r2 = (h * 0.32) * (0.4 + Math.cos(t2 - Math.PI)) * 0.9; x.lineTo(ax + Math.cos(t2 - Math.PI / 2) * r2, ay - 22 - Math.abs(Math.sin(t2 / 2)) * h * 0.35); }
        x.stroke();
      }
      if (made > 0) {
        x.save(); x.translate(hx, hy - 16); if (tt >= 0) x.rotate(st.throwT * 14);
        x.globalAlpha = Math.min(1, 0.25 + made);
        x.fillStyle = st.done ? "#b9c2d6" : glowc + "1)"; x.fillRect(-38, -16, 76, 32);
        x.fillStyle = st.done ? "#7a4f2a" : glowc + ".8)"; x.fillRect(-4, 16, 8, hl * Math.min(1, made * 1.4));
        x.restore();
      }
      if (st.blink > 0) { x.fillStyle = "rgba(0,0,0," + Math.min(0.85, st.blink * 1.4) + ")"; x.fillRect(0, 0, w, h); }
      x.font = "bold 16px Fraunces, 'Noto Serif Thai', serif"; x.textAlign = "left"; x.fillStyle = GOLD2;
      if (st.flinch > 0) x.fillText(U.fly + "!", 16, 26);
      else if (st.work === 0 && !working) x.fillText(U.f_pump + " ↓", 16, 26);
      else if (st.done) x.fillText(U.done + " · " + fmt(st.handle, 1) + " " + U.cm, 16, 26);
      else if (st.work > 0 && !working) x.fillText(U.miss + "…", 16, 26);
      // progress bar
      x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(16, h - 16, w - 32, 6); x.fillStyle = GOLD; x.fillRect(16, h - 16, (w - 32) * made, 6);
    });
  })();

  /* ---------- the Monkey King's staff: fixed mass, shrinking volume ---------- */
  (function () {
    var cv = $("staffcv"); if (!cv) return;
    var M = 13500 * 0.597, Lmin = 0.03, SPAN = 6.52, L = 1.6;
    var REF = [
      { m: 0.06, k: "ear" }, { m: 1.4, k: "monkey" }, { m: 60, k: "chedi" }, { m: 1676, k: "suthep" }, { m: 8849, k: "everest" }, { m: 100000, k: "karman" }];
    function like(rho) { var b = U.like[0][1]; U.like.forEach(function (p) { if (rho >= p[0] * 0.8) b = p[1]; }); return b; }
    var el = $("tlen"); el.value = Math.log10(1.6 / Lmin) / SPAN;
    range("tlen", function (v) { L = Lmin * Math.pow(10, v * SPAN); return L < 1 ? fmt(L * 100, 1) + " " + U.cm : L < 1000 ? fmt(L, 1) + " " + U.m : fmt(L / 1000, 1) + " " + U.km; }, function () {
      var V = Math.PI * L * L * L / 576, rho = M / V;
      set("tden", sci(rho) + " " + U.kgm3); set("twater", sci(rho / 1000)); set("tlike", like(rho));
      cv._dirty = true;
    });
    function shape(x, k, X, gy, s) {
      x.fillStyle = "rgba(174,184,204,.55)"; x.strokeStyle = "rgba(174,184,204,.8)"; x.lineWidth = 1.5; x.beginPath();
      if (k === "ear") { x.ellipse(X, gy - s * 0.5, s * 0.3, s * 0.5, 0, 0, TAU); x.fill(); x.fillStyle = NIGHT; x.beginPath(); x.ellipse(X + s * 0.04, gy - s * 0.5, s * 0.14, s * 0.3, 0, 0, TAU); x.fill(); return; }
      if (k === "monkey") { x.arc(X, gy - s * 0.86, s * 0.12, 0, TAU); x.fill(); x.fillRect(X - s * 0.1, gy - s * 0.74, s * 0.2, s * 0.4); x.fillRect(X - s * 0.1, gy - s * 0.34, s * 0.07, s * 0.34); x.fillRect(X + s * 0.03, gy - s * 0.34, s * 0.07, s * 0.34); x.beginPath(); x.moveTo(X + s * 0.1, gy - s * 0.4); x.quadraticCurveTo(X + s * 0.4, gy - s * 0.3, X + s * 0.3, gy - s * 0.7); x.stroke(); return; }
      if (k === "pillar") { for (var i = 0; i < 3; i++) { x.beginPath(); for (var j = 0; j <= 20; j++) x.lineTo(X - s * 0.8 + j * s * 0.08, gy - s * 0.15 - i * s * 0.12 + Math.sin(j) * s * 0.03); x.stroke(); } return; }
      if (k === "chedi") { x.moveTo(X - s * 0.5, gy); x.lineTo(X - s * 0.4, gy - s * 0.3); x.lineTo(X - s * 0.18, gy - s * 0.42); x.lineTo(X, gy - s); x.lineTo(X + s * 0.18, gy - s * 0.42); x.lineTo(X + s * 0.4, gy - s * 0.3); x.lineTo(X + s * 0.5, gy); x.fill(); return; }
      if (k === "suthep" || k === "everest") { x.moveTo(X - s * 2.2, gy); for (var q = 0; q <= 30; q++) { var u = q / 30; x.lineTo(X - s * 2.2 + u * s * 4.4, gy - s * Math.pow(Math.sin(u * Math.PI), k === "everest" ? 3 : 1.4) * (1 + 0.05 * Math.sin(u * 40))); } x.lineTo(X + s * 2.2, gy); x.fill(); return; }
      if (k === "karman") { x.setLineDash([8, 6]); x.moveTo(0, gy - s); x.lineTo(4000, gy - s); x.stroke(); x.setLineDash([]); }
    }
    toy(cv, function () {
      if (!cv._dirty && cv._w === cv.clientWidth) return;
      cv._dirty = false; cv._w = cv.clientWidth;
      var F = fit(cv), x = F.x, w = F.w, h = F.h, gy = h * 0.9, px = (h * 0.78) / L;
      var V = Math.PI * L * L * L / 576, rho = M / V, heat = Math.max(0, Math.min(1, (Math.log10(rho) + 1) / 12));
      var sky = x.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, "#05070f"); sky.addColorStop(1, "#16223a"); x.fillStyle = sky; x.fillRect(0, 0, w, h);
      x.fillStyle = "#1d2b1a"; x.fillRect(0, gy, w, h - gy);
      x.font = "12px system-ui"; x.textAlign = "center";
      var slot = 0;
      REF.forEach(function (r) {
        var s = r.m * px; if (s < 6 || s > h * 3) return;
        var X = w * (0.38 + 0.2 * slot++);
        if (X > w - 30) return;
        shape(x, r.k, X, gy, s);
      });
      // the staff, standing at left, banded gold at each end, glowing with its density
      var sw = Math.max(3, (L / 12) * px), sx = w * 0.16, top = gy - L * px;
      var g = x.createLinearGradient(sx - sw, 0, sx + sw, 0);
      g.addColorStop(0, "hsl(" + (35 - 35 * heat) + ",70%," + (25 + 30 * heat) + "%)"); g.addColorStop(0.5, "hsl(" + (40 - 40 * heat) + ",90%," + (45 + 35 * heat) + "%)"); g.addColorStop(1, "hsl(" + (35 - 35 * heat) + ",70%," + (22 + 30 * heat) + "%)");
      if (heat > 0.5) { x.save(); x.shadowColor = "rgba(255,120,80," + (heat - 0.5) * 2 + ")"; x.shadowBlur = 40 * heat; }
      x.fillStyle = g; x.fillRect(sx - sw / 2, top, sw, L * px);
      if (heat > 0.5) x.restore();
      x.fillStyle = GOLD; x.fillRect(sx - sw / 2 - 1, top, sw + 2, Math.max(4, L * px * 0.06)); x.fillRect(sx - sw / 2 - 1, gy - Math.max(4, L * px * 0.06), sw + 2, Math.max(4, L * px * 0.06));
      // scale bar
      var bar = Math.pow(10, Math.floor(Math.log10(L / 2))), bpx = bar * px;
      x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 2; x.beginPath(); x.moveTo(w - 30 - bpx, 26); x.lineTo(w - 30, 26); x.moveTo(w - 30 - bpx, 20); x.lineTo(w - 30 - bpx, 32); x.moveTo(w - 30, 20); x.lineTo(w - 30, 32); x.stroke();
      x.fillStyle = "rgba(255,255,255,.8)"; x.fillText(bar < 1 ? fmt(bar * 100) + " " + U.cm : bar < 1000 ? fmt(bar) + " " + U.m : fmt(bar / 1000) + " " + U.km, w - 30 - bpx / 2, 46);
    });
  })();

  /* ---------- the rack: one small drawing per weapon ---------- */
  (function () {
    var D = {
      vajra: function (x) { drawVajra(x, 64, 64, 56, 5, 0.6, 0.2, -0.6, 0); },
      chakra: function (x) { drawChakra(x, 64, 64, 46, 16, 0, GOLD); },
      trident: function (x) { drawTrident(x, 64, 70, 100, GOLD); },
      keraunos: function (x) { x.strokeStyle = BLUE; x.lineWidth = 4; x.lineJoin = "round"; x.beginPath(); [[20, 108], [52, 70], [40, 66], [76, 30], [70, 50], [96, 40], [62, 82], [74, 84], [44, 112]].forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.stroke(); },
      hammer: function (x) { x.fillStyle = "#b9c2d6"; x.fillRect(30, 30, 68, 34); x.fillStyle = "#7a4f2a"; x.fillRect(59, 64, 10, 34); x.fillStyle = GOLD; x.fillRect(57, 96, 14, 6); },
      spear: function (x) { drawSpear(x, 64, 66, 108, GOLD); },
      staff: function (x) { x.save(); x.translate(64, 64); x.rotate(-0.8); x.fillStyle = "#c0391b"; x.fillRect(-52, -5, 104, 10); x.fillStyle = GOLD; x.fillRect(-56, -6, 16, 12); x.fillRect(40, -6, 16, 12); x.restore(); },
      axe: function (x) { x.strokeStyle = "#a8865a"; x.lineWidth = 6; x.beginPath(); x.moveTo(44, 110); x.lineTo(78, 22); x.stroke(); x.fillStyle = "#dfe8f6"; x.beginPath(); x.moveTo(70, 34); x.quadraticCurveTo(112, 20, 108, 62); x.quadraticCurveTo(90, 50, 62, 56); x.fill(); },
      jewel: function (x) { var g = x.createRadialGradient(56, 56, 2, 64, 64, 46); g.addColorStop(0, "#fff"); g.addColorStop(0.35, "#aee6ff"); g.addColorStop(1, "rgba(143,211,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 1.5; x.beginPath(); for (var k = 0; k < 6; k++) { var a = k / 6 * TAU; x.lineTo(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20); } x.closePath(); x.stroke(); },
      astra: function (x) { x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.moveTo(18, 110); x.lineTo(100, 28); x.moveTo(100, 28); x.lineTo(84, 30); x.moveTo(100, 28); x.lineTo(98, 44); x.stroke(); for (var k = 0; k < 12; k++) { x.fillStyle = "hsla(" + (20 + k * 4) + ",100%,60%," + (0.6 - k * 0.04) + ")"; x.beginPath(); x.arc(102 + Math.cos(k) * k * 1.4, 26 - Math.sin(k * 1.3) * k * 1.2, 6 - k * 0.3, 0, TAU); x.fill(); } },
      bow: function (x) { x.strokeStyle = GOLD; x.lineWidth = 4; x.beginPath(); x.arc(20, 64, 70, -0.95, 0.95); x.stroke(); x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(20 + Math.cos(-0.95) * 70, 64 + Math.sin(-0.95) * 70); x.lineTo(20 + Math.cos(0.95) * 70, 64 + Math.sin(0.95) * 70); x.stroke(); },
      sword: function (x) { x.save(); x.translate(64, 64); x.rotate(-0.78); x.fillStyle = "#dfe8f6"; x.beginPath(); x.moveTo(-6, -14); x.lineTo(-4, -56); x.lineTo(0, -60); x.lineTo(4, -56); x.lineTo(6, -14); x.fill(); x.fillStyle = GOLD; x.fillRect(-16, -14, 32, 6); x.fillStyle = "#3a2a1a"; x.fillRect(-4, -8, 8, 34); x.restore(); }
    };
    [].forEach.call(document.querySelectorAll("canvas[data-icon]"), function (c) {
      var x = c.getContext("2d"); x.fillStyle = NIGHT; x.fillRect(0, 0, 128, 128);
      var f = D[c.getAttribute("data-icon")]; if (f) f(x);
    });
  })();

  requestAnimationFrame(loop);
})();
