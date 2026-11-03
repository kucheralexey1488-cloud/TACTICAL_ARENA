/* bot_sprites.js — South Park cut-out sprites, 8 directions, per-weapon draw */

/* ---- character definitions ---- */
const CH = {
  stan:    {n:'Stan',    skin:'#fcdcb6', jac:'#9b5c4c', col:'#d12a47', mit:'#d4243f', pants:'#4259a8', hat:'beanie',  hc:'#4b63ae', hb:'#d12a47', pom:'#d12a47', bw:1,    hr:118, btn:1},
  kyle:    {n:'Kyle',    skin:'#fcdcb6', jac:'#f46b1b', col:'#2f9c3a', mit:'#58c42b', pants:'#38665f', hat:'ushanka', hc:'#56c32b', hb:'#27a031',               bw:.92,  hr:116, pocket:1},
  cartman: {n:'Cartman', skin:'#fcdcb6', jac:'#d3203f', col:'#d3203f', mit:'#f4d51e', pants:'#6a3f25', hat:'beanie',  hc:'#40b5c4', hb:'#f4d71e', pom:'tuft',   bw:1.45, hr:130, chin:1, btn:1},
  kenny:   {n:'Kenny',   skin:'#fcdcb6', jac:'#ff6a10', col:'#ff6a10', mit:'#6b4034', pants:'#f26412', hat:'hood',    hc:'#ff6a14',                               bw:.95,  hr:110}
};
const CK = Object.keys(CH);
const skinC = {};

/* ---- canvas helpers ---- */
function rr(g, x, y, w, h, r){
  g.beginPath(); g.moveTo(x+r, y);
  g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r);
  g.arcTo(x, y+h, x, y, r);     g.arcTo(x, y, x+w, y, r);
  g.closePath();
}

/* held weapon drawing per bot class */
function gunDraw(g, t){
  const f = (c,x,y,w,h) => { g.fillStyle=c; g.fillRect(x,y,w,h); g.strokeRect(x,y,w,h); };
  const poly = (c,pts) => { g.fillStyle=c; g.beginPath(); pts.forEach((p,i) => i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fill(); g.stroke(); };
  if (t==='Assaulter'){
    f('#6a3f1f',-100,-14,62,30); f('#26272a',-38,-18,78,26); f('#7b4a26',40,-14,52,22);
    f('#18181a',92,-10,50,7); f('#18181a',138,-15,6,15);
    poly('#202124',[[-5,8],[28,8],[40,56],[18,58]]);
    poly('#26272a',[[-38,8],[-18,8],[-8,44],[-26,44]]);
  } else if (t==='Pistoler'){
    f('#2b2d31',-14,-18,70,20); f('#34363b',-10,2,52,10);
    poly('#202124',[[-14,2],[6,2],[0,44],[-20,44]]);
    f('#111',52,-14,10,8);
  } else if (t==='Shotgunner'){
    f('#6a3f1f',-105,-12,62,26); f('#26272a',-44,-16,66,24);
    f('#18181a',22,-12,120,8); f('#18181a',22,-2,110,7); f('#7b4a26',45,2,52,16);
  } else if (t==='Knifer'){
    f('#15161a',-30,-8,40,16); f('#8a8f95',10,-12,10,24);
    poly('#d7dde2',[[20,-12],[100,-6],[24,12]]);
  } else {
    f('#2d3034',-90,-14,66,28); f('#26292d',-24,-18,86,24); f('#1a1b1d',62,-10,100,7);
    f('#111',-8,-36,56,16); f('#111',-12,-36,6,16); f('#111',44,-38,8,20); f('#2d3034',20,6,10,30);
  }
}

/* ---- draw one frame at angle a (0=front, PI/4=front-right, ...) ---- */
function drawFrame(g, s, a, wt){
  const sn = Math.sin(a), cs = Math.cos(a);
  const back = cs < -.25, fk = Math.max(Math.abs(cs), .3);
  const cx = 256, hr = s.hr, hx = cx + sn*12, hy = 196;
  const bw = 118 * s.bw * (.76 + .24*Math.abs(cs));
  const hood = s.hat === 'hood';
  const OL = 'rgba(35,22,22,.78)';
  const fx = hx + sn*hr*.58, zx = cx + sn*bw*.7;

  g.lineJoin = 'round'; g.lineCap = 'round';
  g.lineWidth = 3; g.strokeStyle = OL;

  const el = (x,y,rx,ry,f,rot) => {
    g.beginPath(); g.ellipse(x,y,rx,ry,rot||0,0,7);
    if (f){ g.fillStyle=f; g.fill(); } g.stroke();
  };
  const mitt = (x,y,r,d) => { el(x,y,r,r*1.05,s.mit); el(x+d*r*.75,y-r*.55,r*.45,r*.55,s.mit); };

  // legs + shoes
  [-1,1].forEach(i => {
    rr(g, cx+i*bw*.42-30, 425, 60, 50, 10);
    g.fillStyle = s.pants; g.fill(); g.stroke();
    el(cx+i*bw*.45, 478, 40, 12, '#17171a');
  });
  // upper arms behind torso
  [-1,1].forEach(i => {
    g.save(); g.translate(cx+i*bw*.98, 352); g.rotate(-i*.14);
    el(0,0,26,58,s.jac); g.restore();
  });
  // torso
  g.beginPath();
  g.moveTo(cx-bw*.72, 300);
  g.bezierCurveTo(cx-bw*.96, 340, cx-bw*1.06, 402, cx-bw, 440);
  g.lineTo(cx+bw, 440);
  g.bezierCurveTo(cx+bw*1.06, 402, cx+bw*.96, 340, cx+bw*.72, 300);
  g.closePath();
  g.fillStyle = s.jac; g.fill();
  const gr = g.createLinearGradient(0,300,0,440);
  gr.addColorStop(0,'rgba(255,255,255,.1)'); gr.addColorStop(1,'rgba(0,0,0,.18)');
  g.fillStyle = gr; g.fill(); g.stroke();
  // collar
  if (!hood) el(cx, 316, bw*.64, 26, s.col);
  // front details
  if (cs > .15){
    g.beginPath(); g.moveTo(zx, hood?340:330); g.lineTo(zx, 438); g.stroke();
    if (s.btn) [360,392,424].forEach(y => { g.fillStyle='#111'; g.beginPath(); g.arc(zx-34*cs, y, 5, 0, 7); g.fill(); });
    if (s.pocket) [-1,1].forEach(i => {
      const w = 42*cs, px = zx+i*56*cs - w/2;
      g.strokeStyle = '#8c3c10'; g.strokeRect(px, 376, w, 34);
      g.beginPath(); g.moveTo(px, 376); g.lineTo(px+w, 410);
      g.moveTo(px+w, 376); g.lineTo(px, 410); g.stroke();
      g.strokeStyle = OL;
    });
  }
  // arms + weapon
  if (Math.abs(sn) <= .3){
    mitt(cx-bw*1.05, 392, 28, -1);
    const gx = cx+bw*.55;
    if (!back){
      g.fillStyle = '#232427'; rr(g, gx, 360, 44, 44, 6); g.fill(); g.stroke();
      g.fillStyle = '#000'; g.beginPath(); g.arc(gx+22, 382, 9, 0, 7); g.fill();
    }
    mitt(gx+22, 402, 26, 1);
  } else {
    const d = Math.sign(sn), x0 = cx+d*bw*.25, k = Math.max(.4, Math.abs(sn));
    g.save(); g.translate(x0, 372); g.scale(d*k, 1); g.lineWidth = 2.5;
    gunDraw(g, wt.t);
    g.restore(); g.lineWidth = 3;
    mitt(cx-d*bw*.95, 392, 26, -d);
    mitt(x0, 386, 26, d);
    mitt(x0+d*70*k, 392, 24, d);
  }
  // head
  if (!hood) el(hx, hy, hr, hr*.97, s.skin);

  // hats
  if (s.hat === 'beanie'){
    const by0 = hy-hr*.43, bh = s.chin?24:36, by1 = by0+bh;
    const top = hy-hr*1.04, tp = by0+(top-by0)/.75, W = hr*1.06;
    g.beginPath();
    g.moveTo(hx-W, by0+4);
    g.bezierCurveTo(hx-W, tp, hx+W, tp, hx+W, by0+4);
    g.closePath();
    g.fillStyle = s.hc; g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(hx-W-4, by0);
    g.quadraticCurveTo(hx, by0+8, hx+W+4, by0);
    g.lineTo(hx+W+4, by1);
    g.quadraticCurveTo(hx, by1+8, hx-W-4, by1);
    g.closePath();
    g.fillStyle = s.hb; g.fill(); g.stroke();
    if (s.pom === 'tuft'){
      [[-16,4,20,12],[8,-4,24,14],[28,6,15,9]].forEach(([dx,dy,rx,ry]) => el(hx+dx, top+dy+6, rx, ry, '#f4d71e'));
    } else {
      const px = hx, py = top-8, r = 24;
      el(px, py, r, r, s.pom);
      for(let kk=0; kk<40; kk++){
        const an = kk/40*PI*2;
        g.strokeStyle = kk%2 ? '#e8506f' : '#9c1830';
        g.beginPath();
        g.moveTo(px+Math.cos(an)*r*.7, py+Math.sin(an)*r*.7);
        g.lineTo(px+Math.cos(an)*(r+9), py+Math.sin(an)*(r+9));
        g.stroke();
      }
      g.strokeStyle = OL;
    }
  } else if (s.hat === 'ushanka'){
    const fl = Math.abs(cs);
    [-1,1].forEach(i => {
      g.save(); g.translate(hx+i*hr*.99*fl, hy+hr*.1); g.rotate(-i*.2*fl);
      el(0,0,34+12*(1-fl),96,s.hc); g.restore();
    });
    rr(g, hx-hr*1.02, hy-hr*1.2, hr*2.04, hr*.86, hr*.16);
    g.fillStyle = s.hc; g.fill(); g.stroke();
    rr(g, hx-hr*.97, hy-hr*.7, hr*1.94, hr*.34, 6);
    g.fillStyle = s.hb; g.fill(); g.stroke();
  }

  // face
  if (!back && !hood){
    const sep = hr*.27*fk, ey = hy+hr*.2;
    const rx = hr*.3*Math.max(fk,.55), ry = hr*.36;
    [-1,1].forEach(i => {
      const x = fx+i*sep;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x,ey,rx,ry,0,0,7); g.fill(); g.stroke();
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(x+sn*rx*.5+6*cs, ey+2, 6.5, 0, 7); g.fill();
    });
    g.beginPath(); g.arc(fx, hy+hr*.68+12, 16*fk, PI*1.15, PI*1.85); g.stroke();
    if (s.chin){ g.beginPath(); g.ellipse(hx+sn*hr*.2, hy+hr*.5, hr*.8*fk, hr*.42, 0, PI*.12, PI*.88); g.stroke(); }
  }
  // hood overlay
  if (hood){
    el(cx, 330, bw*.78, 40, s.jac);
    el(hx, hy+6, hr*1.26, hr*1.22, s.hc);
    if (!back){
      const ox = hx+sn*hr*.5;
      g.beginPath(); g.ellipse(ox, hy+8, hr*.98*fk, hr*.95, 0, 0, 7);
      g.fillStyle = '#7b4a35'; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(ox, hy+12, hr*.72*fk, hr*.8, 0, 0, 7);
      g.fillStyle = s.skin; g.fill(); g.stroke();
      const sep = hr*.2*fk, ey = hy+8;
      const rx = hr*.26*Math.max(fk,.55), ry = hr*.34;
      [-1,1].forEach(i => {
        const x = ox+i*sep;
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x,ey,rx,ry,0,0,7); g.fill(); g.stroke();
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(x+sn*rx*.5+5*cs, ey+2, 6, 0, 7); g.fill();
      });
    }
    if (cs > .1){
      g.beginPath();
      g.moveTo(zx-14*cs, hy+hr*1.15); g.lineTo(zx-14*cs, 386);
      g.moveTo(zx+14*cs, hy+hr*1.15); g.lineTo(zx+14*cs, 380);
      g.stroke();
    }
  }
}

/* atlas: 8 frames x 512px = 4096x512, cached per (char, botType) */
function skinTex(charName, cfg){
  const key = charName + '_' + cfg.n;
  if (skinC[key]) return skinC[key];
  const c = document.createElement('canvas');
  c.width = 4096; c.height = 512;
  const g = c.getContext('2d');
  const wt = {t: cfg.n};
  for(let d=0; d<8; d++){
    g.save();
    g.translate(d*512, 0);
    g.beginPath(); g.rect(0,0,512,512); g.clip();
    drawFrame(g, CH[charName], d*PI/4, wt);
    g.restore();
  }
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = 8;
  return skinC[key] = t;
}

/* ---- override buildBot: same hitboxes, real sprite material ---- */
buildBot = function(cfg){
  const g = new T.Group(), m = new T.Group();
  m.visible = false; g.add(m);

  const hit = [], mt = new T.MeshBasicMaterial();
  const b = new T.Mesh(new T.BoxGeometry(1,.95,.5), mt);
  b.position.y = .5; b.userData.part = 'body'; m.add(b); hit.push(b);
  const hd = new T.Mesh(new T.CylinderGeometry(.46,.46,.9,12), mt);
  hd.position.y = 1.3; hd.userData.part = 'head'; m.add(hd); hit.push(hd);

  const sk = CK[Math.floor(R()*CK.length)];
  const tex = skinTex(sk, cfg);
  const mat = new T.MeshLambertMaterial({
    map: tex, transparent: true, alphaTest: .1, side: T.DoubleSide,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .6,
    toneMapped: false
  });
  const sp = new T.Mesh(new T.PlaneGeometry(2.1, 2.1), mat);
  sp.position.y = 1.05; g.add(sp);

  const bl = new T.Mesh(new T.CircleGeometry(.7, 16),
    new T.MeshBasicMaterial({color: 0, transparent: true, opacity: .45, depthWrite: false}));
  bl.rotation.x = -PI/2; bl.position.y = .02; g.add(bl);

  g.userData = {sp, mat, sk, dir: -1, face: 0, lp: new T.Vector3(), hp: 0, flash: 0, dead: 0};
  return {g, m, hit};
};

/* ---- override spriteUpdate: UV frame switching + red hit flash ---- */
spriteUpdate = function(dt){
  const b = bot;
  if (!b || !b.g.userData.sp) return;
  const u = b.g.userData, gp = b.g.position;

  // billboard facing camera
  const tc = Math.atan2(cam.position.x - gp.x, cam.position.z - gp.z);
  u.sp.rotation.y = tc - b.g.rotation.y;

  // death fade
  if (!b.alive){
    u.dead = Math.min(1, u.dead + dt*2.5);
    u.sp.scale.y = 1 - .75*u.dead;
    u.sp.position.y = 1.05*u.sp.scale.y;
    return;
  }

  // smooth facing toward player / movement dir
  const vx = gp.x - u.lp.x, vz = gp.z - u.lp.z;
  u.lp.copy(gp);
  const want = (b.los || Math.hypot(vx,vz) < .0005)
    ? Math.atan2(P.pos.x-gp.x, P.pos.z-gp.z)
    : Math.atan2(vx, vz);
  let d = want - u.face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  u.face += d * Math.min(1, dt*6);

  // UV frame selection (8 directions)
  const rel = u.face - tc;
  const dir = ((Math.round(rel / (PI/4)) % 8) + 8) % 8;
  if (dir !== u.dir){
    u.dir = dir;
    const uv = u.sp.geometry.attributes.uv;
    const a = dir/8, c = (dir+1)/8;
    uv.setX(0, a); uv.setX(1, c);
    uv.setX(2, a); uv.setX(3, c);
    uv.needsUpdate = true;
  }

  // hit flash
  if (u.hp > 0 && b.hp < u.hp) u.flash = .12;
  u.hp = b.hp;
  u.flash -= dt;
  u.mat.emissive.setHex(u.flash > 0 ? 0xff2a2a : 0xffffff);
  u.mat.emissiveIntensity = u.flash > 0 ? 1 : .6;

  // walk bob
  u.sp.position.y = 1.05 + Math.abs(Math.sin(time*9 + b.seed))*.04;

  // character name in enemy readout
  $('en').textContent = CH[u.sk].n + ' \u00b7 ' + b.cfg.n;

  if (b.blind > 0) b.blind -= dt;
};