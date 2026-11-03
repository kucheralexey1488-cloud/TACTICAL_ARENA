/* player.js — P state, input, movement, camera, damage */
const P = {
  pos: new T.Vector3(0,0,26), vel: new T.Vector3(),
  yaw: 0, pitch: 0, hp: 100, onG: true,
  slide: 0, cd: 0, sd: new T.Vector3(), eye: 1.7,
  ads: 0, kick: 0, ck: 0, bob: 0, tilt: 0, fx: 0,
  msx: 0, msy: 0, th: 0, insp: 0,
  sw: 0, swing: 0, spin: 0, n: 0,
  magCheck: 0, magMesh: null
};
const keys = {};
let mouse = 0, rmb = 0, slideReq = 0, fb = 0, shake = 0;
let hurtT = 0; // визуальный урон-эффект (см. main.js)
const isLocked = () => document.pointerLockElement === cv || fb;

/* ---- input ---- */
addEventListener('mousemove', e => {
  if (!isLocked() || state === 'dead' || shopOpen) return;
  const s = 0.0022 * (1 - P.ads * 0.55 * (cam.fov < 30 ? 1 : 0.5));
  P.yaw   -= e.movementX * s;
  P.pitch  = clamp(P.pitch - e.movementY * s, -1.45, 1.45);
  P.msx   -= e.movementX * 0.0004;
  P.msy   -= e.movementY * 0.0004;
});
addEventListener('mousedown', e => {
  if (!isLocked() || shopOpen) return;
  if (e.button === 0){ mouse = 1; if (typeof W !== 'undefined' && !W[cur].auto) tryFire(); }
  if (e.button === 2) rmb = 1;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse = 0; if (e.button === 2) rmb = 0; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (['Space','ControlLeft','ControlRight','Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = 1;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') slideReq = 1;
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; mouse = rmb = 0; });

/* ---- pointer lock lifecycle ---- */
document.addEventListener('pointerlockerror', () => { fb = 1; $('ov').style.display = 'none'; });
document.addEventListener('pointerlockchange', () => {
  $('ov').style.display = (isLocked() || state === 'dead') ? 'none' : 'flex';
});

/* ---- damage ---- */
function hurtPlayer(d){
  if (state !== 'fight') return;
  if (typeof armor !== 'undefined' && armor > 0){
    const ab = Math.min(armor, d * 0.6); armor -= ab; d -= ab;
  }
  P.hp -= d;
  $('fl').style.opacity = .9;
  shake = .04;
  if (typeof sfx === 'function') sfx(90, .15, .1);
  if (P.hp <= 0){
    P.hp = 0; state = 'dead';
    $('ds').textContent = 'You survived ' + Math.max(0, round-1) + ' round(s)';
    $('dead').style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
  }
}

/* ---- movement + camera update ---- */
function updateMovement(dt){
  const w = W[cur], st = stats(cur);
  const f = (keys.KeyW?1:0) - (keys.KeyS?1:0);
  const s = (keys.KeyD?1:0) - (keys.KeyA?1:0);
  const sn = Math.sin(P.yaw), cs = Math.cos(P.yaw);
  let wx = -sn*f + cs*s, wz = -cs*f - sn*s;
  const wl = Math.hypot(wx,wz);
  if (wl > 0){ wx /= wl; wz /= wl; }

  const ads = !!(keys.ControlLeft || keys.ControlRight || rmb);

  // slide
  if (slideReq && P.cd <= 0 && P.onG && wl > 0){
    P.slide = .75; P.cd = 3; P.sd.set(wx,0,wz);
  }
  slideReq = 0; P.cd = Math.max(0, P.cd - dt);

  if (P.slide > 0){
    const k = P.slide / .75, v = 6 + 8*k*k;
    P.vel.x = P.sd.x * v; P.vel.z = P.sd.z * v;
    P.slide -= dt;
    if (keys.Space) P.slide = 0;
  } else {
    const sp = 6.2 * (ads ? .72 : 1);
    const k = P.onG ? 12 : 3;
    P.vel.x = damp(P.vel.x, wx*sp, k, dt);
    P.vel.z = damp(P.vel.z, wz*sp, k, dt);
  }

  if (keys.Space && P.onG){ P.vel.y = 8; P.onG = false; }
  P.vel.y -= 24*dt;
  P.pos.addScaledVector(P.vel, dt);
  if (P.pos.y <= 0){ P.pos.y = 0; P.vel.y = 0; P.onG = true; }
  collide(P.pos, .4, P.pos.y);

  // smoothing
  P.eye  = damp(P.eye,  P.slide > 0 ? .8 : 1.7, 11, dt);
  P.ads  = damp(P.ads,  ads ? 1 : 0, 11, dt);
  P.kick = damp(P.kick, 0, 11, dt);
  P.ck   = damp(P.ck,   0, 9, dt);
  P.tilt = damp(P.tilt, P.slide > 0 ? .07 : 0, 8, dt);
  P.fx   = damp(P.fx,   P.slide > 0 ? 9 : 0, 8, dt);
  shake  = damp(shake, 0, 10, dt);
  P.msx  = damp(P.msx, 0, 8, dt);
  P.msy  = damp(P.msy, 0, 8, dt);

  // bob
  const spd = Math.hypot(P.vel.x, P.vel.z);
  P.bob += dt * spd * 1.5 * (P.onG ? 1 : 0);
  const bobY = Math.sin(P.bob*2) * .025 * Math.min(spd/6,1) * (P.slide > 0 ? 0 : 1 - P.ads*.8);

  // camera
  cam.position.set(P.pos.x, P.pos.y + P.eye + bobY, P.pos.z);
  cam.rotation.set(P.pitch + P.ck + (R()-.5)*shake,
                   P.yaw + (R()-.5)*shake,
                   P.tilt);
  cam.fov = 75 + (st.fov - 75) * P.ads + P.fx * (1 - P.ads);
  cam.updateProjectionMatrix();
}