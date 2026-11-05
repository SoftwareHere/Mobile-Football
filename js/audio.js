/* Pixel Gridiron - tiny WebAudio synth for retro sound effects, crowd and menu music */
(function () {
  'use strict';
  const PG = window.PG;
  const A = { ctx: null, on: true, musicOn: true, master: null, crowdNode: null, musicTimer: null };

  A.unlock = () => {
    if (!A.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC();
        A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
        A.noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
        const d = A.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { A.ctx = null; return; }
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
  };
  A.setOn = (v) => { A.on = v; if (!v) A.crowd(false); };
  A.setMusic = (v) => { A.musicOn = v; if (!v) A.stopMusic(); };
  const ok = () => A.on && A.ctx && A.ctx.state === 'running';

  A.tone = (f, dur, type, vol, slide, delay) => {
    if (!ok()) return;
    const t = A.ctx.currentTime + (delay || 0);
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  };
  A.noise = (dur, vol, freq, type, delay, q) => {
    if (!ok()) return;
    const t = A.ctx.currentTime + (delay || 0);
    const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 800; if (q) f.Q.value = q;
    const g = A.ctx.createGain(); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };

  A.blip = (f) => A.tone(f || 660, 0.06, 'square', 0.08);
  A.click = () => A.tone(1200, 0.03, 'square', 0.05);
  A.hike = () => { A.tone(170, 0.07, 'square', 0.12, 120); A.tone(170, 0.07, 'square', 0.1, 120, 0.12); };
  A.whistle = () => {
    if (!ok()) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain(), lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2500; lfo.frequency.value = 38; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(A.master); o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
  };
  A.throw = () => A.noise(0.18, 0.12, 1400, 'bandpass', 0, 1.2);
  A.whoosh = () => A.noise(0.14, 0.1, 900, 'bandpass', 0, 1.5);
  A.catch = () => { A.tone(150, 0.08, 'sine', 0.25, 90); A.noise(0.04, 0.12, 2000, 'highpass'); };
  A.thud = () => A.tone(95, 0.12, 'sine', 0.25, 60);
  A.hit = (k) => { k = k || 1; A.noise(0.16, 0.25 * k, 500, 'lowpass'); A.tone(80, 0.1, 'sine', 0.2 * k, 50); };
  A.td = (k) => {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => A.tone(n, 0.11, 'square', 0.08 * (k || 1), null, i * 0.09));
    A.noise(1.6, 0.18 * (k || 1), 1800, 'bandpass', 0.05, 0.6);
  };
  A.boo = (kind) => {
    if (kind === 'cheer') A.noise(1.2, 0.2, 2000, 'bandpass', 0, 0.6);
    else A.noise(1.2, 0.18, 350, 'bandpass', 0, 0.8);
  };
  A.levelUp = () => [523, 784, 1047, 1319].forEach((n, i) => A.tone(n, 0.12, 'triangle', 0.12, null, i * 0.08));
  A.coin = () => { A.tone(988, 0.06, 'square', 0.08); A.tone(1319, 0.14, 'square', 0.08, null, 0.06); };

  A.crowd = (on) => {
    if (!A.ctx) return;
    if (on && A.on && !A.crowdNode) {
      const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
      const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
      const g = A.ctx.createGain(); g.gain.value = 0.035;
      s.connect(f); f.connect(g); g.connect(A.master); s.start();
      A.crowdNode = { s, g };
    } else if (!on && A.crowdNode) {
      try { A.crowdNode.s.stop(); } catch (e) { /* ignore */ }
      A.crowdNode = null;
    }
  };

  // simple looping chiptune for menus
  const SONG = {
    bpm: 112,
    lead: [72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 77, 81, 0, 79, 77, 76, 72, 0, 76, 79, 0, 84, 83, 81, 79, 0, 77, 76, 74, 76, 72, 0],
    bass: [48, 48, 55, 55, 50, 50, 57, 57, 48, 48, 55, 55, 53, 53, 55, 55],
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  A.startMusic = () => {
    if (!A.ctx || !A.musicOn || !A.on || A.musicTimer) return;
    let step = 0;
    const dur = 60 / SONG.bpm / 2;
    A.musicTimer = setInterval(() => {
      if (!ok()) return;
      const n = SONG.lead[step % SONG.lead.length];
      if (n) A.tone(mtof(n), dur * 0.9, 'square', 0.035);
      if (step % 2 === 0) A.tone(mtof(SONG.bass[(step / 2) % SONG.bass.length]), dur * 1.8, 'triangle', 0.06);
      if (step % 4 === 2) A.noise(0.05, 0.03, 6000, 'highpass');
      step++;
    }, dur * 1000);
  };
  A.stopMusic = () => { if (A.musicTimer) { clearInterval(A.musicTimer); A.musicTimer = null; } };

  PG.Audio = A;
})();
