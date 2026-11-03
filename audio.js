/* audio_music.js — procedural music + surface-aware footsteps */

/* ---- music state ---- */
const mus = {on: 0, mute: 0, step: 0, next: 0, g: null};
const RT = [55, 43.65, 65.41, 49];   // root note per bar

function startMusic(){
  if (!ac || mus.on) return;
  try { bus(); } catch(e){ return; }
  mus.on = 1;
  mus.g = ac.createGain();
  mus.g.gain.value = .4;
  mus.g.connect(ac.destination);
  mus.next = ac.currentTime + .1;
  setInterval(musTick, 100);
}

/* ---- layer primitives ---- */
function tone(ty, f, t, d, v, lp){
  if (!mus.g) return;
  const o = ac.createOscillator(), g = ac.createGain(), flt = ac.createBiquadFilter();
  o.type = ty; o.frequency.value = f;
  flt.type = 'lowpass'; flt.frequency.value = lp;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t+.01);
  g.gain.exponentialRampToValueAtTime(.001, t+d);
  o.connect(flt); flt.connect(g); g.connect(mus.g);
  o.start(t); o.stop(t+d+.05);
}
function mnoise(t, d, v, hp){
  if (!mus.g || !nb) return;
  const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nb;
  flt.type = 'highpass'; flt.frequency.value = hp;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(.001, t+d);
  s.connect(flt); flt.connect(g); g.connect(mus.g);
  s.start(t, 0, d+.02);
}
function kick(t){
  if (!mus.g) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t+.18);
  g.gain.setValueAtTime(.5, t);
  g.gain.exponentialRampToValueAtTime(.001, t+.25);
  o.connect(g); g.connect(mus.g);
  o.start(t); o.stop(t+.3);
}

/* ---- 64-step sequencer at 112 BPM ---- */
function musTick(){
  if (!ac || !mus.g) return;
  const sd = 60/112/4;                 // 16th note
  const fight = state === 'fight';
  while (mus.next < ac.currentTime + .3){
    const s = mus.step, t = mus.next, r = RT[(s>>4) & 3];
    if (!mus.mute){
      // bar-opening chord pad
      if (s % 16 === 0) [1, 1.189, 1.498].forEach(m => tone('sawtooth', r*4*m, t, sd*16, .035, 500));
      if (fight){
        // drums
        if (s % 4 === 0) kick(t);
        if (s % 8 === 4) mnoise(t, .15, .25, 1500);
        if (s % 2 === 0) mnoise(t, .04, .08, 7000);
        // bass
        tone('sawtooth', r * [1,1,2,1,1,2,1.5,1][(s>>1) & 7], t, sd*1.6, .16, 260 + (s%16)*30);
        // arp
        if (s % 2 === 1) tone('square', r*8*[1,1.189,1.498,1.189,2,1.498,1.189,1.498][(s>>1) & 7], t, sd*1.5, .03, 1800);
      } else {
        // calm prep: sparse
        if (s % 8 === 0) tone('sine', r*2, t, sd*6, .12, 300);
        if (s % 8 === 6) mnoise(t, .05, .04, 8000);
      }
    }
    mus.step = (s + 1) % 64;
    mus.next += sd;
  }
}

/* ---- M key toggles music ---- */
addEventListener('keydown', e => {
  if (e.code === 'KeyM' && mus.g){
    mus.mute ^= 1;
    mus.g.gain.value = mus.mute ? 0 : .4;
    toast(mus.mute ? 'Music off' : 'Music on');
  }
});

/* ---- start on overlay click (main.js already created ac in same event) ---- */
const overlay = document.getElementById('ov') || $('ov');
if (overlay) {
    overlay.addEventListener('click', startMusic);
}

/* ---- surface-aware footsteps ----
   main.js's extras() plays noise(.07, .05, 500, 0) for every step.
   We intercept that exact signature and replace with per-surface. */
function stepSound(spd){
  if (!ac) return;
  const surf = P.pos.y > .5 ? 'metal' : (curMap === 'sand' ? 'sand' : 'concrete');
  const vol = .04 + Math.min(spd/8, 1)*.03;
  if (surf === 'sand'){
    noise(.09, vol*1.2, 800, 0);
    noise(.04, vol*.5, 2500, 0);
  } else if (surf === 'metal'){
    noise(.05, vol*1.3, 2500, 1);
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(500 + R()*300, t);
    o.frequency.exponentialRampToValueAtTime(180, t+.08);
    g.gain.setValueAtTime(vol*.8, t);
    g.gain.exponentialRampToValueAtTime(.001, t+.1);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t+.12);
  } else {
    noise(.07, vol, 500, 0);
    noise(.03, vol*.4, 3000, 0);
  }
}

/* wrap noise to intercept main.js's footstep call */
const _orig_noise = noise;
noise = function(d, v, f, rev){
  if (d === .07 && v === .05 && f === 500 && !rev){
    stepSound(Math.hypot(P.vel.x, P.vel.z));
    return;
  }
  _orig_noise(d, v, f, rev);
};
