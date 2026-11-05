/* Pixel Gridiron - practice drill minigames (throwing targets, catching gauntlet) */
(function () {
  'use strict';
  const PG = window.PG, U = PG.U, Pl = PG.Player, Sp = PG.Sprites, F = PG.Font, I = PG.Input, Fd = PG.Field;
  const W = 53.33, YS = 0.6, ZS = 0.75;

  class Drill {
    // o: {kind:'throw'|'catch', player, team, settings, diff, perks:Set, onEnd(score01, text)}
    constructor(o) {
      this.o = o; this.t = 0; this.n = 0; this.max = 8; this.pts = 0; this.done = false;
      const p = o.player;
      const r = {}; for (const k of ['spd', 'acc', 'agi', 'thp', 'tas', 'tam', 'tad', 'tor', 'cth', 'jmp']) r[k] = Pl.attr(p, k);
      this.u = { x: o.kind === 'throw' ? 30 : 52, y: W / 2, vx: 0, vy: 0, r, face: 1, anim: 0, pal: Sp.palette(o.team, true, Pl.look(p)), maxSpd: 5.6 + r.spd * 0.038, accel: 4.5 + r.acc * 0.085 };
      this.cam = { x: this.u.x - 15, y: W / 2 - 14 };
      this.ball = null; this.msg = null; this.sc = null; this.nextAt = 1.2;
      if (o.kind === 'throw') this.newTarget();
    }
    setView(w, h) { this.vw = w; this.vh = h; this.ppy = U.clamp(w / 55, 6, 8.6); }
    S(x, y, z) { return [Math.round((x - this.cam.x) * this.ppy), Math.round((y - this.cam.y) * this.ppy * YS - (z || 0) * ZS * this.ppy)]; }
    newTarget() {
      const d = U.rnd(8, 42);
      this.tgt = { x: this.u.x + d, y: U.clamp(W / 2 + U.rnd(-16, 16), 4, W - 4), r: d > 30 ? 2.8 : 2.2, vy: this.n >= 4 ? U.pick([-2.5, 2.5]) : 0 };
    }
    flash(text, color) { this.msg = { text, color: color || '#fff', t: 0 }; }

    update(dt) {
      dt = Math.min(dt, 1 / 30);
      const evs = I.take();
      this.t += dt;
      if (this.msg) { this.msg.t += dt; if (this.msg.t > 1.2) this.msg = null; }
      const u = this.u;
      const st = I.stick();
      const sp = u.maxSpd;
      const ax = st.x * sp - u.vx, ay = st.y * sp - u.vy, m = Math.hypot(ax, ay), lim = u.accel * dt * 1.4;
      u.vx += m > lim ? ax / m * lim : ax; u.vy += m > lim ? ay / m * lim : ay;
      u.x = U.clamp(u.x + u.vx * dt, this.o.kind === 'throw' ? 20 : 30, this.o.kind === 'throw' ? 40 : 90);
      u.y = U.clamp(u.y + u.vy * dt, 2, W - 2);
      u.anim += Math.hypot(u.vx, u.vy) * dt * 0.55;
      if (this.tgt && this.tgt.vy) { this.tgt.y += this.tgt.vy * dt; if (this.tgt.y < 5 || this.tgt.y > W - 5) this.tgt.vy *= -1; }
      for (const ev of evs) {
        if (ev.type === 'pause') { this.finish(); return; }
        if (this.o.kind === 'throw' && ev.type === 'release' && !this.ball && this.n < this.max) this.throwBall(ev);
        if (this.o.kind === 'catch' && (ev.type === 'press' || (ev.type === 'tap' && ev.key)) && this.sc && !this.sc.tapped) this.tapSkill();
      }
      if (this.o.kind === 'catch' && !this.ball && this.n < this.max && this.t > this.nextAt) this.fire();
      if (this.ball) {
        const b = this.ball;
        b.t += dt;
        const f = Math.min(1, b.t / b.T);
        b.x = U.lerp(b.sx, b.ex, f); b.y = U.lerp(b.sy, b.ey, f); b.z = U.lerp(2, 1.1, f) + 4 * b.apex * f * (1 - f);
        if (f >= 1) this.land();
      }
      // camera
      const vw = this.vw / this.ppy, vh = this.vh / (this.ppy * YS);
      const fx = this.ball ? U.lerp(this.ball.x, this.ball.ex, 0.5) : this.o.kind === 'throw' ? u.x + 18 : u.x;
      const tx = U.clamp(fx - vw * 0.45, -5, 125 - vw), ty = U.clamp((this.ball ? this.ball.y : u.y) - vh / 2, -9, W + 9 - vh);
      const k = 1 - Math.pow(0.03, dt);
      this.cam.x = U.lerp(this.cam.x, tx, k); this.cam.y = U.lerp(this.cam.y, ty, k);
      if (this.n >= this.max && !this.ball && !this.done && this.t > this.endAt) this.finish();
    }
    throwBall(ev) {
      let dx = ev.dx, dy = ev.dy;
      if (Math.hypot(dx, dy) < 8) return;
      if (this.o.settings.aimMode !== 'push') { dx = -dx; dy = -dy; }
      const u = this.u;
      let tx = u.x + dx / this.ppy * 2.5, ty = u.y + dy / (this.ppy * YS) * 2.5;
      const d = Math.hypot(tx - u.x, ty - u.y);
      const acc = d < 12 ? u.r.tas : d < 25 ? u.r.tam : u.r.tad;
      let sigma = d * (0.026 + (100 - acc) * 0.0011) * this.o.diff.err;
      if (this.o.perks.has('pinpoint')) sigma *= 0.7;
      const sp = Math.hypot(u.vx, u.vy);
      if (sp > 2) sigma += sp / 8 * (1.6 - u.r.tor / 100);
      tx += U.gauss() * sigma; ty += U.gauss() * sigma * 0.8;
      const dd = Math.hypot(tx - u.x, ty - u.y);
      const speed = 15 + u.r.thp * 0.12;
      const apex = dd < 8 ? 0.6 : dd < 18 ? 1.4 + (dd - 8) * 0.1 : 2.4 + (dd - 18) * 0.17;
      this.ball = { sx: u.x, sy: u.y, ex: tx, ey: ty, t: 0, T: Math.max(0.2, dd / speed * (1 + apex * 0.05)), apex, x: u.x, y: u.y, z: 2 };
      u.pose = 'release'; u.poseT = 0.3;
      if (PG.Audio) PG.Audio.throw();
    }
    fire() {
      const u = this.u;
      const ex = U.clamp(u.x + U.rnd(-5, 5), 32, 88), ey = U.clamp(u.y + U.rnd(-5, 5), 3, W - 3);
      const T = U.rnd(1.0, 1.5) - this.n * 0.04;
      this.ball = { sx: 26, sy: W / 2, ex, ey, t: 0, T, apex: 2.2, x: 26, y: W / 2, z: 2 };
      const win = this.o.diff.win * (this.o.perks.has('surehands') ? 1.35 : 1);
      this.sc = { start: this.t + T - Math.min(1.2, T - 0.05), end: this.t + T, ring: Math.min(1.2, T - 0.05), win, tapped: false };
      if (PG.Audio) PG.Audio.throw();
    }
    tapSkill() {
      const sc = this.sc;
      if (this.t < sc.start - 0.05) return;
      sc.tapped = true;
      const dtm = Math.abs(this.t - sc.end), w = sc.win;
      if (dtm <= 0.06 * w) { sc.grade = 'PERFECT'; sc.bonus = 0.25; }
      else if (dtm <= 0.13 * w) { sc.grade = 'GREAT'; sc.bonus = 0.15; }
      else if (dtm <= 0.22 * w) { sc.grade = 'GOOD'; sc.bonus = 0.07; }
      else { sc.grade = this.t < sc.end ? 'EARLY' : 'LATE'; sc.bonus = -0.05; }
      if (PG.Audio) PG.Audio.blip(sc.bonus > 0.1 ? 880 : 440);
    }
    land() {
      const b = this.ball, u = this.u;
      this.n++;
      if (this.o.kind === 'throw') {
        const d = Math.hypot(b.ex - this.tgt.x, b.ey - this.tgt.y);
        let p = 0;
        if (d < this.tgt.r * 0.45) { p = 150; this.flash('BULLSEYE! +150', '#3cff7a'); }
        else if (d < this.tgt.r) { p = 90; this.flash('HIT! +90', '#ffe14d'); }
        else if (d < this.tgt.r * 1.8) { p = 25; this.flash('CLOSE +25', '#fff'); }
        else this.flash('MISS', '#ff6060');
        this.pts += p;
        if (p > 0 && PG.Audio) PG.Audio.catch();
        if (this.n < this.max) this.newTarget();
      } else {
        const d = Math.hypot(u.x - b.ex, u.y - b.ey);
        const reach = 1.0 + u.r.jmp * 0.007;
        const sc = this.sc;
        if (d > reach) this.flash('OUT OF REACH', '#ff6060');
        else {
          const pc = U.clamp(0.6 + (u.r.cth - 60) * 0.0085 - Math.max(0, d - 0.6) * 0.18 + (sc && sc.tapped ? sc.bonus : 0), 0.05, 0.99);
          if (Math.random() < pc) {
            const p = sc && sc.grade === 'PERFECT' ? 150 : sc && sc.bonus > 0.1 ? 120 : 90;
            this.pts += p; this.flash((sc && sc.tapped ? sc.grade + ' ' : '') + 'CATCH +' + p, '#3cff7a');
            if (PG.Audio) PG.Audio.catch();
          } else this.flash('DROPPED', '#ff6060');
        }
        this.sc = null;
        this.nextAt = this.t + 0.9;
      }
      this.ball = null;
      if (this.n >= this.max) this.endAt = this.t + 1.2;
    }
    finish() {
      if (this.done) return;
      this.done = true;
      const score = U.clamp(this.pts / (this.max * 150), 0, 1);
      if (this.o.onEnd) this.o.onEnd(score, `${this.pts} pts`);
    }

    render(ctx) {
      ctx.imageSmoothingEnabled = false;
      const t = this.o.team;
      Fd.draw(ctx, this.ppy, YS, this.cam, { left: t, right: t, home: t, away: t, weather: 'clear' });
      const u = this.u;
      if (this.tgt && this.o.kind === 'throw') {
        const [tx, ty] = this.S(this.tgt.x, this.tgt.y);
        const rx = this.tgt.r * this.ppy, ry = this.tgt.r * this.ppy * YS;
        ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(tx, ty, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (this.o.kind === 'catch') {
        const [mx, my] = this.S(26, W / 2);
        ctx.fillStyle = '#666'; ctx.fillRect(mx - 4, my - 8, 8, 8); ctx.fillStyle = '#e33'; ctx.fillRect(mx - 2, my - 10, 6, 3);
      }
      const [sx, sy] = this.S(u.x, u.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx - 4, sy - 1, 8, 2);
      const moving = Math.hypot(u.vx, u.vy) > 0.6;
      const lower = moving ? ['run1', 'run2', 'run3', 'run2'][Math.floor(u.anim * 2.2) % 4] : 'stand';
      if (u.poseT) { u.poseT -= 1 / 60; if (u.poseT <= 0) { u.pose = null; u.poseT = 0; } }
      const upper = u.pose || (this.o.kind === 'throw' && !this.ball ? 'carry' : this.sc && this.sc.end - this.t < 0.35 ? 'catch' : 'idle');
      ctx.drawImage(Sp.get(u.pal, upper, lower, this.o.kind === 'catch'), sx - Sp.W / 2, sy - Sp.H + 1);
      if (this.ball) {
        const b = this.ball;
        const [rx, ry] = this.S(b.ex, b.ey);
        if (this.o.kind === 'catch') { ctx.strokeStyle = '#ffe14d'; ctx.beginPath(); ctx.ellipse(rx + 0.5, ry + 0.5, 5, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
        const [gx, gy] = this.S(b.x, b.y); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx - 1, gy - 1, 3, 1);
        const [bx, by] = this.S(b.x, b.y, b.z); ctx.fillStyle = '#7a3f17'; ctx.fillRect(bx - 1, by - 1, 3, 2); ctx.fillStyle = '#fff'; ctx.fillRect(bx, by - 1, 1, 1);
      }
      // aim
      if (this.o.kind === 'throw' && I.drag.active && !this.ball) {
        let dx = I.drag.x - I.drag.ox, dy = I.drag.y - I.drag.oy;
        if (this.o.settings.aimMode !== 'push') { dx = -dx; dy = -dy; }
        const tx = u.x + dx / this.ppy * 2.5, ty = u.y + dy / (this.ppy * YS) * 2.5;
        ctx.fillStyle = '#fff';
        for (let i = 1; i < 14; i++) { const f = i / 14; const [px, py] = this.S(U.lerp(u.x, tx, f), U.lerp(u.y, ty, f), 2 + 3 * f * (1 - f) * 2); ctx.fillRect(px, py, 1, 1); }
        const [rx, ry] = this.S(tx, ty); ctx.strokeStyle = '#ffe14d'; ctx.beginPath(); ctx.ellipse(rx + 0.5, ry + 0.5, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // HUD
      const W2 = this.vw, H2 = this.vh;
      ctx.fillStyle = 'rgba(10,12,20,0.85)'; ctx.fillRect(W2 / 2 - 80, 2, 160, 11);
      F.draw(ctx, `${this.o.kind === 'throw' ? 'TARGET PRACTICE' : 'CATCH GAUNTLET'}  ${Math.min(this.n + (this.ball ? 1 : 0), this.max)}/${this.max}  ${this.pts} PTS`, W2 / 2, 4, { align: 'center', color: '#ffe14d' });
      ctx.fillStyle = 'rgba(10,12,20,0.75)'; ctx.fillRect(W2 - 20, 2, 18, 13); F.draw(ctx, 'X', W2 - 11, 5, { align: 'center' });
      F.draw(ctx, this.o.kind === 'throw' ? 'DRAG BACK ON THE RIGHT & RELEASE' : 'MOVE UNDER THE BALL · TAP WHEN RINGS MEET', W2 / 2, H2 - 10, { align: 'center', color: 'rgba(255,255,255,0.6)', shadow: false });
      if (this.msg) F.draw(ctx, this.msg.text, W2 / 2, H2 * 0.35, { align: 'center', scale: 2, color: this.msg.color });
      if (this.sc) {
        const sc = this.sc, cx = Math.round(W2 * 0.76), cy = Math.round(H2 * 0.58);
        if (this.t >= sc.start - 0.05) {
          const f = U.clamp((sc.end - this.t) / sc.ring, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3cff7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
          if (!sc.tapped) { ctx.strokeStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(cx, cy, 16 + f * 34, 0, Math.PI * 2); ctx.stroke(); }
          ctx.lineWidth = 1;
          F.draw(ctx, sc.tapped ? sc.grade : 'TAP!', cx, cy - 3, { align: 'center', color: '#fff' });
        }
      }
      // joystick
      const j = I.joy;
      ctx.globalAlpha = j.active ? 0.5 : 0.2; ctx.strokeStyle = '#fff';
      const jx = j.active ? j.ox : 36, jy = j.active ? j.oy : H2 - 36;
      ctx.beginPath(); ctx.arc(jx, jy, I.R, 0, Math.PI * 2); ctx.stroke();
      const s2 = I.stick(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(jx + s2.x * I.R * 0.8, jy + s2.y * I.R * 0.8, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  PG.Drill = Drill;
})();
