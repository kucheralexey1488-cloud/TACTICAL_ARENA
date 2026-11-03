/* weapon.js — weapon catalogue, builders, firing, IK hands, animations */

/* ===== shared mutable state (global across classic scripts) ===== */
var state = 'prep', round = 0, shopOpen = 0, money = 800, armor = 0, bot = null;
var fireCd = 0, reloadT = 0, flashT = 0, hmT = 0, hmC = '#fff';

/* safe stubs — real versions live in main.js */
function sfx(){}
function toast(){}
function dnum(){}
function hurtBot(){}

/* ===== effects buffer shared with main.js ===== */
const fxs = [];

/* ===== weapon catalogue data ===== */
const CATS = ['Melee','Pistol','SMG','Rifle','Shotgun','MG','Sniper'];
const W = {}, inv = {}, ORDER = [];
const ATN = {muzzle:'Muzzle Brake', holo:'Holo Sight', mag:'Extended Mag'};
const PR = {
  knife:0,axe:250,machete:300,katana:600,bat:150,crowbar:200,
  glock:0,m1911:300,m9:250,usp:300,fn57:450,mak:150,deagle:750,python:700,g18:900,
  mp5:1300,ump:1200,mp7:1400,uzi:1000,mac10:900,skorp:600,p90:1700,vector:1800,
  ak:2700,ak74u:2000,m4:3000,hk416:3300,m16:2800,scar:3400,aug:3200,g36:2900,famas:2500,g3:3000,
  rem870:1200,spas:1800,dbl:900,benelli:2000,aa12:3500,
  m249:5200,pkm:5000,rpk:4200,minigun:9000,
  svd:3000,kar98:1800,mosin:1400,sr25:3500,avm:4200,m24:3800,barrett:5500
};
const APR = {muzzle:300, holo:400, mag:350};
const HP = [.14,-.16,-.3];

function WD(id, cat, n, dmg, rate, mag, rl, auto, spr, rec, fov, x){
  W[id] = Object.assign({
    n,cat,dmg,rate,mag,rl,auto:auto?1:0,pel:1,spr,rec,fov,
    hip:[.19,-.2,-.4],mv:1,snd:[170,.14]
  }, x||{});
  ORDER.push(id);
  inv[id] = {ammo:mag, at:{}};
}

/* ===== geometry helpers ===== */
const B = (p,w,h,l,x,y,z,m,rx) => { const o=new T.Mesh(new T.BoxGeometry(w,h,l),m); o.position.set(x,y,z); if(rx)o.rotation.x=rx; p.add(o); return o; };
const C = (p,r,len,x,y,z,m) => { const o=new T.Mesh(new T.CylinderGeometry(r,r,len,14),m); o.rotation.x=PI/2; o.position.set(x,y,z); p.add(o); return o; };
const chai = (p,n) => { for(;n>0;n--){ const q=[]; for(let i=0;i<p.length;i++){ const a=p[i],b=p[(i+1)%p.length]; q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]); } p=q; } return p; };

function prof(g, pts, w, mat, sm, bv, hole){
  if (sm){ pts = chai(pts, sm); if (hole) hole = chai(hole, sm); }
  const s = new T.Shape();
  pts.forEach((p,i) => i ? s.lineTo(-p[0],p[1]) : s.moveTo(-p[0],p[1]));
  if (hole){ const h = new T.Path(); hole.forEach((p,i) => i ? h.lineTo(-p[0],p[1]) : h.moveTo(-p[0],p[1])); s.holes.push(h); }
  bv = bv || 0;
  const d = Math.max(w - 2*bv, .002);
  const geo = new T.ExtrudeGeometry(s, {depth:d, bevelEnabled:bv>0, bevelThickness:bv, bevelSize:bv*.8, bevelSegments:2, curveSegments:6});
  geo.translate(0,0,-d/2); geo.rotateY(PI/2);
  const o = new T.Mesh(geo, mat); g.add(o); return o;
}
function lathe(g, pts, x, y, z, m, seg){
  pts = pts.slice().sort((a,b) => a[1]-b[1]);
  const v = pts.map(p => new T.Vector2(p[0], p[1]));
  v.unshift(new T.Vector2(0, pts[0][1])); v.push(new T.Vector2(0, pts[pts.length-1][1]));
  const geo = new T.LatheGeometry(v, seg||20); geo.rotateX(PI/2);
  const o = new T.Mesh(geo, m); o.position.set(x,y,z); g.add(o); return o;
}
function banana(len, curve, hw, mz, y0){
  const Lf = [], Rr = [];
  for(let i=0;i<=6;i++){
    const k = i/6, cz = mz - curve*k*k, y = y0 - len*k;
    Lf.push([cz-hw, y]); Rr.push([cz+hw, y]);
  }
  return Lf.concat(Rr.reverse());
}
function muzzle(g, t, y, z){
  const m = M.steel, k = M.blk;
  if (t==='ak'){ lathe(g,[[.0115,-.056],[.0145,-.05],[.0145,-.01],[.012,0]],0,y,z,m); B(g,.012,.01,.03,0,y+.014,z-.04,k); return .056; }
  if (t==='fh'){ lathe(g,[[.0105,-.068],[.0128,-.062],[.0128,-.01],[.0115,0]],0,y,z,m); for(let i=0;i<3;i++) B(g,.0035,.0145,.045,0,y,z-.04,k).rotation.z=i*PI/3; return .068; }
  if (t==='brake'){ lathe(g,[[.012,-.075],[.017,-.07],[.017,-.01],[.013,0]],0,y,z,m); for(let i=0;i<3;i++) B(g,.036,.0045,.007,0,y,z-.025-i*.015,k); return .075; }
  if (t==='sup'){ lathe(g,[[.013,-.22],[.0255,-.215],[.0255,-.02],[.019,0]],0,y,z,k); for(let i=1;i<5;i++) lathe(g,[[.0258,0],[.0258,-.004]],0,y,z-i*.04,m); return .22; }
  return 0;
}
function iron(g, y, zr, zf){
  const m = M.metal;
  B(g,.006,.02,.012,-.014,y-.01,zr,m);
  B(g,.006,.02,.012, .014,y-.01,zr,m);
  B(g,.005,.022,.008, 0,y-.011,zf,m);
}
function iron2(g, sy, rz, fz, ry0, fy0){
  const m = M.metal;
  if (sy-.02 > ry0) B(g,.02, sy-.02-ry0, .03, 0, (sy-.02+ry0)/2, rz, m);
  if (sy-.02 > fy0) B(g,.018, sy-.02-fy0, .02, 0, (sy-.02+fy0)/2, fz, m);
  iron(g, sy, rz, fz);
}
function holo(g, y, z){
  const m = M.metal;
  B(g,.05,.01,.1,0,y+.005,z,m);
  B(g,.006,.05,.09,-.024,y+.03,z,m);
  B(g,.006,.05,.09, .024,y+.03,z,m);
  B(g,.054,.008,.09,0,y+.058,z,m);
  B(g,.044,.044,.002,0,y+.032,z-.03,new T.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.12}));
  const d = new T.Mesh(new T.SphereGeometry(.0035,8,8), new T.MeshBasicMaterial({color:0xff3322}));
  d.position.set(0,y+.03,z-.028); g.add(d);
  return y+.03;
}
function trig(g, y, z){
  const m = M.metal;
  B(g,.006,.006,.07,0,y-.032,z,m);
  B(g,.006,.03,.006,0,y-.016,z-.035,m);
  B(g,.006,.03,.006,0,y-.016,z+.035,m);
  B(g,.005,.02,.006,0,y-.012,z+.002,m,.3);
}

/* ===== weapon builders ===== */
function rifle(g, p, at){
  const m = M.metal, pl = p.tan?M.tan:p.poly?M.poly:M.metal, wd = M.wood;
  const rl=p.rl, rh=p.rh, rw=p.rw, t=rh/2, sz=rl/2;
  const hl = p.hg ? p.hg[1] : 0, ht = p.hg ? p.hg[0] : '';
  const by = p.ak?.012:.006, mg = at.mag?1.35:1, z0 = -sz-hl;
  prof(g,[[-sz,t],[sz*.9,t],[sz,t-.01],[sz,-t+.012],[sz*.85,-t],[-sz,-t]], rw, pl, 0, .002);
  if (p.ak) prof(g,[[-sz*.92,t],[sz*.82,t],[sz*.82,t+.01],[sz*.5,t+.017],[-sz*.92,t+.012]], rw*.82, m, 0, .002);
  else prof(g,[[-sz*.95,t],[sz*.7,t],[sz*.75,t+.008],[-sz*.95,t+.008]], rw*.7, m, 0, .002);
  B(g,.003,rh*.35,.05,rw/2+.001,.012,-.03,M.blk);
  if (ht==='wood'){ prof(g,[[-sz+.01,.03],[z0,.022],[z0,-.03],[-sz+.01,-.04]], rw+.004, wd, 1, .002); prof(g,[[-sz,.046],[z0+hl*.15,.04],[z0+hl*.15,.03],[-sz,.032]], rw*.65, wd, 0, .001); }
  else if (ht==='round'){ lathe(g,[[.0315,-hl],[.032,-hl*.5],[.0325,0]],0,.002,-sz,pl); lathe(g,[[.0345,0],[.0345,-.012]],0,.002,-sz,m); for(let i=1;i<4;i++) lathe(g,[[.0335,0],[.0335,-.005]],0,.002,-sz-hl*i*.25,m); }
  else if (ht==='box') prof(g,[[-sz,.034],[z0,.03],[z0,-.04],[-sz+.01,-.042]], rw+.012, pl, 1, .002);
  if (p.rail){ B(g,.02,.004,sz*2+hl,0,t+.008,-hl/2,m); for(let z=z0+.01;z<sz-.02;z+=.017) B(g,.022,.006,.009,0,t+.012,z,m); }
  if (p.gas && hl) C(g,.0095,hl*.95,0,.04,-sz-hl/2,m);
  const bl = p.bl, br = p.bw || .0095;
  lathe(g,[[br*.82,-bl],[br*.9,-bl*.6],[br*1.12,-bl*.04],[br*1.12,0]],0,by,z0,m);
  if (p.ak || p.gas) lathe(g,[[.0165,-.03],[.0165,0]],0,by,z0-bl*.55,m);
  let tip = z0 - bl;
  const fz = p.ak ? tip+.05 : z0-.03;
  tip -= muzzle(g, at.muzzle?'brake':p.mzt||'none', by, tip);
  let sy = t + .03;
  if (p.sight === 'scope'){
    const sl = p.sl || .3, s2 = p.sz || 0, y0 = t + .052;
    lathe(g,[[.0155,s2-sl/2],[.0155,s2+sl/2]],0,y0,0,M.blk);
    lathe(g,[[.0155,s2-sl/2],[.026,s2-sl/2-.02],[.032,s2-sl/2-.05],[.032,s2-sl/2-.075]],0,y0,0,M.blk);
    lathe(g,[[.0155,s2+sl/2],[.024,s2+sl/2+.01],[.026,s2+sl/2+.05]],0,y0,0,M.blk);
    const gl = new T.Mesh(new T.CircleGeometry(.029,16), MT(0x1a2e44,.05,.1,{transparent:true,opacity:.65}));
    gl.position.set(0,y0,s2-sl/2-.074); gl.rotation.y = PI; g.add(gl);
    const tu = new T.Mesh(new T.CylinderGeometry(.01,.01,.026,12), m); tu.position.set(0,y0+.022,s2); g.add(tu);
    const ts = tu.clone(); ts.rotation.z = PI/2; ts.position.set(.022,y0,s2); g.add(ts);
    [-1,1].forEach(i => prof(g,[[s2+i*sl*.3-.014,t],[s2+i*sl*.3+.014,t],[s2+i*sl*.3+.01,y0-.005],[s2+i*sl*.3-.01,y0-.005]],.02,m,0,.001));
    sy = y0;
  } else if (at.holo || p.sight === 'dot') sy = holo(g, t + (p.topmag?.045 : p.rail?.015 : .006), -.02);
  else { if (p.sight === 'carry'){ prof(g,[[-.08,t+.01],[.09,t+.01],[.09,t+.045],[.06,t+.052],[-.06,t+.052],[-.08,t+.03]], .02, pl, 0, .002); sy = t+.058; } iron2(g, sy, p.sight==='carry'?.07:sz-.04, fz, t+(p.ak?.015:0), by+.01); }
  const sk = p.st || ['none',0], L = sk[1];
  if (sk[0]==='wood'){ prof(g,[[sz-.005,t-.004],[sz+L*.55,t-.022],[sz+L,t-.014],[sz+L+.004,-t-.075],[sz+L*.6,-t-.062],[sz+.02,-t*.15],[sz-.005,-t]], .04, wd, 1, .002); prof(g,[[sz+L,t-.014],[sz+L+.01,t-.014],[sz+L+.014,-t-.08],[sz+L+.004,-t-.077]], .042, M.blk, 0, .001); }
  else if (sk[0]==='fix'){ prof(g,[[sz,t],[sz+L*.4,t+.014],[sz+L,t+.006],[sz+L+.004,-t-.09],[sz+L*.7,-t-.098],[sz+L*.3,-t-.03],[sz,-t]], .042, pl, 1, .002); prof(g,[[sz+L,t+.006],[sz+L+.012,t+.006],[sz+L+.016,-t-.092],[sz+L+.004,-t-.09]], .046, M.blk, 0, .001); }
  else if (sk[0]==='m4'){ lathe(g,[[.0165,sz],[.0165,sz+L]],0,0,0,m); prof(g,[[sz+.02,.025],[sz+L,.03],[sz+L+.01,-.09],[sz+L-.07,-.1],[sz+.04,-.03]], .045, pl, 1, .002); prof(g,[[sz+L,.03],[sz+L+.014,.03],[sz+L+.02,-.088],[sz+L+.01,-.09]], .046, M.blk, 0, .001); }
  else if (sk[0]==='fold'){ [-1,1].forEach(i => B(g,.006,.006,L,i*.016,.012,sz+L/2,m)); prof(g,[[sz+L,.03],[sz+L+.008,.03],[sz+L+.008,-.035],[sz+L,-.035]],.044,m,0,.001); }
  else if (sk[0]==='skel'||sk[0]==='wskel'){ prof(g,[[sz,t],[sz+L,t-.01],[sz+L+.004,-t-.08],[sz,-t]], sk[0]==='wskel'?.04:.03, sk[0]==='wskel'?wd:pl, 0, .002, [[sz+L*.25,t-.03],[sz+L*.8,t-.04],[sz+L*.8,-t-.04],[sz+L*.25,-t-.01]]); prof(g,[[sz+L,t-.01],[sz+L+.01,t-.01],[sz+L+.014,-t-.082],[sz+L+.004,-t-.08]],.042,M.blk,0,.001); }
  const gz = p.gz !== undefined ? p.gz : sz-.06, tz = p.tz !== undefined ? p.tz : gz-.055;
  if (p.gr !== 0) prof(g,[[gz-.022,-t+.004],[gz+.026,-t+.004],[gz+.05,-t-.1],[gz+.034,-t-.118],[gz+.0,-t-.11],[gz-.014,-t-.04]],.034, p.ak?M.poly:pl, 1, .002);
  trig(g, -t, tz);
  const mm = p.mag || ['none',0], mz0 = p.mgz !== undefined ? p.mgz : -rl*.08;
  if (mm[0]==='ak') prof(g, banana(.2*(mm[1]/.1)*mg, .05*(mm[1]/.1)*mg, .032, mz0, -t), .04, m, 0, .002);
  else if (mm[0]==='stk'||mm[0]==='box') prof(g, banana(mm[1]*mg, .012, .028, mz0, -t), .032, mm[0]==='box'?M.gl:m, 0, .002);
  if (p.topmag) prof(g,[[-.16,t],[.1,t],[.1,t+.03],[-.16,t+.026]],.055, M.gl, 0, .002);
  if (p.mgbox){ prof(g,[[mz0-.08,-t],[mz0+.08,-t],[mz0+.085,-t-.12],[mz0-.085,-t-.12]],.095, pl, 0, .002); for(let i=0;i<6;i++) B(g,.014,.014,.02, rw/2+.012+i*.003, t-.01-i*.014, mz0, M.brass); }
  if (p.carry) B(g,.012,.03,.14,0,t+.045,z0+.05,m);
  if (p.bipod) [-1,1].forEach(i => B(g,.006,.006,.22,i*.02,-.035,z0-.12,m));
  if (p.bolt){ B(g,.05,.01,.012,.04,.015,sz*.3,m); const bb = new T.Mesh(new T.SphereGeometry(.013,10,10),m); bb.position.set(.068,.015,sz*.3); g.add(bb); }
  g.userData.mz = tip; g.userData.by = by;
  return sy;
}
function pistol(g, p, at){
  const m = M.metal, pl = M.poly, sl = p.sl, sh = p.sh, sw = p.sw || .03, fz = -sl+.04, y0 = -sh/2;
  prof(g,[[fz,sh/2-.004],[fz+.012,sh/2],[.032,sh/2],[.04,sh/2-.008],[.04,y0],[fz,y0]], sw, m, 0, .0018);
  for(let i=0;i<5;i++) B(g,sw+.002,sh*.72,.0035,0,0,.034-i*.0065,M.blk);
  B(g,.003,sh*.5,.04,sw/2+.001,0,-.02,M.blk);
  prof(g,[[fz+.02,y0],[.036,y0],[.046,y0-.018],[.058,y0-.115],[.016,y0-.122],[-.004,y0-.05],[-.006,y0-.038],[-.04,y0-.038],[-.062,y0-.03],[-.066,y0-.012],[fz+.06,y0-.006],[fz+.02,y0-.006]], sw-.004, p.steel?m:pl, 0, .002, [[-.013,y0-.014],[-.057,y0-.014],[-.057,y0-.03],[-.013,y0-.032]]);
  prof(g,[[.038,y0-.016],[.056,y0-.112],[.018,y0-.12],[-.002,y0-.05],[.0,y0-.02]], sw+.004, p.wg?M.wood:pl, 0, .002);
  B(g,sw+.006,at.mag?.06:.014,.054,0, y0-.125-(at.mag?.025:0), .036, m, -.2);
  B(g,.005,.02,.006,0,y0-.024,-.02,m,.3);
  if (p.hammer) prof(g,[[.04,sh/2],[.052,sh/2+.012],[.05,sh/2-.004]], .008, m, 0, .0008);
  let sy = sh/2 + .012;
  if (at.holo) sy = holo(g, sh/2, -.02); else iron2(g, sy, .03, fz+.01, sh/2, sh/2);
  let tip = fz;
  lathe(g,[[.0072,-.012],[.0072,0]],0,0,fz,m);
  tip -= .012; tip -= muzzle(g, at.muzzle?'sup':'none', 0, tip);
  g.userData.mz = tip; g.userData.by = 0;
  return sy;
}
function revolver(g, p, at){
  const m = M.metal;
  prof(g,[[-.065,.04],[.03,.044],[.05,.03],[.052,-.012],[.02,-.036],[-.06,-.034]],.026,m,0,.002);
  lathe(g,[[.0295,-.09],[.0295,-.03]],0,.004,0,m);
  for(let i=0;i<6;i++){ const a=i*PI/3; lathe(g,[[.0062,-.092],[.0062,-.028]],Math.cos(a)*.019,.004+Math.sin(a)*.019,0,M.blk); }
  lathe(g,[[.0095,-.2],[.0115,-.12],[.012,0]],0,.022,-.09,m);
  prof(g,[[-.09,.0],[-.26,.002],[-.26,-.026],[-.09,-.03]],.02,m,0,.002);
  B(g,.012,.008,.19,0,.037,-.19,m);
  prof(g,[[.03,.025],[.056,.02],[.085,-.11],[.045,-.128],[.025,-.045]],.034,M.wood,1,.002);
  prof(g,[[.04,.044],[.056,.056],[.05,.034]],.008,m,0,.0008);
  trig(g, -.037, .0);
  let tip = -.29, sy = .05;
  if (at.holo) sy = holo(g,.04,0); else iron2(g,sy,.04,tip+.02,.0375,.034);
  tip -= muzzle(g, at.muzzle?'sup':'none', .022, tip);
  g.userData.mz = tip; g.userData.by = .022;
  return sy;
}
function shotgun(g, p, at){
  const m = M.metal, wd = M.wood, pl = M.poly, t = p.t, ex = at.mag?1.3:1;
  let sy = .045, tip;
  if (t==='dbl'){
    prof(g,[[-.07,.036],[.07,.036],[.075,-.03],[-.07,-.034]],.05,m,0,.002);
    [-1,1].forEach(i => lathe(g,[[.0097,-.62],[.0105,-.5],[.0105,0]],i*.0105,.014,-.07,m));
    B(g,.012,.008,.62,0,.029,-.38,m);
    prof(g,[[-.07,0],[-.26,.002],[-.26,-.034],[-.07,-.036]],.046,wd,1,.002);
    prof(g,[[.07,.034],[.2,.03],[.36,.02],[.375,-.09],[.3,-.1],[.17,-.045],[.07,-.03]],.045,wd,1,.002);
    prof(g,[[.36,.02],[.372,.02],[.386,-.09],[.375,-.09]],.05,M.blk,0,.001);
    B(g,.008,.01,.04,0,.04,.04,m);
    trig(g,-.03,.02);
    tip = -.69;
  } else {
    const sp = t === 'pump';
    prof(g,[[-.12,.038],[.13,.038],[.13,-.034],[-.12,-.034]],.05, sp?m:pl, 0, .002);
    lathe(g,[[.0115,-.62],[.0125,-.4],[.0125,0]],0,.013,-.12,m);
    lathe(g,[[.0115,-.5*ex],[.0115,0]],0,-.022,-.12,m);
    prof(g,[[-.19,0],[-.36,.002],[-.36,-.05],[-.19,-.052]],.056, sp?wd:pl, 1, .002);
    B(g,.003,.03,.06,.026,.005,0,M.blk);
    if (sp){ prof(g,[[.13,.034],[.3,.026],[.43,.016],[.44,-.09],[.37,-.1],[.2,-.04],[.13,-.03]],.044,wd,1,.002); prof(g,[[.43,.016],[.442,.016],[.452,-.09],[.44,-.09]],.047,M.blk,0,.001); }
    else { prof(g,[[.13,.03],[.2,.03],[.2,-.04],[.13,-.034]],.04,pl,0,.002); prof(g,[[.2,.03],[.5,.02],[.515,-.1],[.2,-.045]],.042,pl,1,.002); prof(g,[[.03,-.03],[.06,-.03],[.075,-.12],[.045,-.125]],.036,pl,1,.002); }
    if (t==='aa') prof(g,[[-.07,-.034],[.06,-.034],[.062,-.17],[-.075,-.17]],.06,pl,0,.002);
    trig(g,-.037,.04);
    tip = -.745;
  }
  if (at.holo) sy = holo(g,.0375,.02); else iron2(g,sy,.09,tip+.03,.0375,.0255);
  tip -= muzzle(g, at.muzzle?'brake':'none', .013, tip);
  g.userData.mz = tip; g.userData.by = .013;
  return sy;
}
function minigun(g, p, at){
  const m = M.metal, pl = M.poly;
  B(g,.11,.12,.22,0,0,.05,pl);
  B(g,.09,.09,.1,0,0,-.1,m);
  C(g,.05,.12,0,0,-.2,m);
  const rot = new T.Group(); rot.position.set(0,0,-.38); g.add(rot);
  for(let i=0;i<6;i++){ const a=i*PI/3; C(rot,.0075,.6,Math.cos(a)*.028,Math.sin(a)*.028,0,m); }
  [-.22,.05,.27].forEach(z => C(rot,.04,.012,0,0,z,M.steel));
  B(g,.02,.05,.22,0,.09,.04,m);
  B(g,.03,.03,.2,0,.12,.04,pl);
  B(g,.06,.06,.2,.1,0,.1,pl);
  B(g,.036,.1,.045,0,-.1,.12,pl,-.3);
  B(g,.03,.1,.04,0,-.1,-.02,pl,.2);
  trig(g,-.06,.05);
  g.userData.rot = rot; g.userData.mz = -.72; g.userData.by = 0;
  return .1;
}
function melee(g, p){
  const j = new T.Group(), t = p.t, bl = M.blade;
  j.rotation.x = .3; g.add(j);
  if (t==='knife'){ prof(j,[[-.075,.016],[-.2,.016],[-.265,-.002],[-.2,-.014],[-.075,-.018]],.004,bl,0,.0008); B(j,.0045,.003,.13,0,.006,-.14,M.blk); prof(j,[[-.07,.026],[-.063,.026],[-.066,-.026],[-.073,-.026]],.014,M.metal,0,.0008); prof(j,[[-.065,.015],[.04,.017],[.056,0],[.04,-.017],[-.065,-.015]],.024,M.blk,1,.002); }
  else if (t==='axe'){ lathe(j,[[.015,-.18],[.0135,0],[.017,.22]],0,0,0,M.wood); prof(j,[[-.17,.04],[-.23,.062],[-.31,.062],[-.318,-.05],[-.23,-.046],[-.17,-.03]],.012,M.steel,0,.001); prof(j,[[-.308,.062],[-.32,.062],[-.328,-.052],[-.318,-.05]],.006,bl,0,.0006); }
  else if (t==='machete'){ prof(j,[[-.1,.03],[-.5,.034],[-.57,.004],[-.5,-.026],[-.1,-.026]],.004,bl,0,.0008); prof(j,[[-.095,.016],[.04,.018],[.052,0],[.04,-.018],[-.095,-.016]],.024,M.blk,1,.002); }
  else if (t==='katana'){ prof(j,[[-.1,.014],[-.5,.017],[-.85,.013],[-.9,-.004],[-.85,-.012],[-.5,-.013],[-.1,-.012]],.005,bl,0,.0007); lathe(j,[[.042,-.108],[.042,-.1]],0,0,0,M.metal); lathe(j,[[.015,-.1],[.015,.17]],0,0,0,M.blk); B(j,.014,.012,.018,0,0,.18,M.metal); }
  else if (t==='bat'){ lathe(j,[[.013,.2],[.015,.08],[.022,-.15],[.032,-.5],[.034,-.72]],0,0,0,M.wood); }
  else { lathe(j,[[.011,.02],[.011,-.62]],0,0,0,M.steel); prof(j,[[-.62,.01],[-.7,.02],[-.74,.05],[-.7,0],[-.65,-.01]],.012,M.steel,0,.001); prof(j,[[.02,0],[.05,.03],[.06,0],[.03,-.02]],.012,M.steel,0,.001); }
  g.userData.mz = -.3; g.userData.by = 0;
  return .06;
}

/* --- AWM from reference photo --- */
const PZ = x => (x-500)*.00167, PY = y => (140-y)*.00167, Pt = a => a.map(([x,y]) => [PZ(x), PY(y)]);
function awm(g, p, at){
  const m = M.metal, gr = M.green, bk = M.blk;
  prof(g, Pt([[280,128],[545,126],[620,130],[700,133],[703,172],[655,186],[612,203],[586,209],[560,191],[548,166],[500,157],[285,155]]), .042, gr, 1, .003, Pt([[562,173],[576,166],[592,170],[600,182],[590,193],[571,191]]));
  prof(g, Pt([[400,114],[565,114],[565,128],[400,128]]), .03, bk, 0, .001);
  [430,515].forEach(x => prof(g, Pt([[x-11,128],[x+11,128],[x+9,76],[x-9,76]]), .032, m, 0, .001));
  const sy = PY(92);
  lathe(g,[[.0235,PZ(395)],[.0235,PZ(545)]],0,sy,0,bk);
  lathe(g,[[.0235,PZ(395)],[.036,PZ(380)],[.038,PZ(362)]],0,sy,0,bk);
  lathe(g,[[.0235,PZ(545)],[.03,PZ(556)],[.031,PZ(572)]],0,sy,0,bk);
  const gl = new T.Mesh(new T.CircleGeometry(.035,16), MT(0x1a2e44,.05,.1,{transparent:true,opacity:.7}));
  gl.position.set(0,sy,PZ(362)-.001); gl.rotation.y = PI; g.add(gl);
  const tu = new T.Mesh(new T.CylinderGeometry(.011,.011,.03,12), bk); tu.position.set(0,sy+.03,PZ(468)); g.add(tu);
  const ts = tu.clone(); ts.rotation.z = PI/2; ts.position.set(.03,sy,PZ(468)); g.add(ts);
  const mh = at.mag ? 20 : 0;
  prof(g, Pt([[440,155],[490,155],[490,195+mh],[440,195+mh]]), .03, bk, 0, .001);
  prof(g, Pt([[498,157],[548,157],[548,182],[498,182]]), .006, m, 0, .0005, Pt([[505,160],[541,160],[541,176],[505,176]]));
  B(g,.005,.022,.006,0,PY(168),PZ(522),m,.2);
  lathe(g,[[.0105,PZ(20)],[.0125,PZ(120)],[.0135,PZ(285)]],0,.03,0,m);
  let tip = PZ(14);
  if (at.muzzle){ tip -= muzzle(g,'sup',.03,tip); }
  else { lathe(g,[[.0135,PZ(14)],[.0145,PZ(26)],[.0145,PZ(48)],[.0125,PZ(52)]],0,.03,0,M.orange); for(let i=0;i<2;i++) B(g,.032,.004,.007,0,.03,PZ(30)+i*.014,bk); }
  B(g,.04,.008,.008,.04,PY(140),PZ(560),m);
  const kb = new T.Mesh(new T.SphereGeometry(.013,10,10), m); kb.position.set(.064,PY(140),PZ(560)); g.add(kb);
  prof(g, Pt([[700,125],[735,128],[737,198],[703,200]]), .046, bk, 0, .002);
  prof(g, Pt([[618,122],[698,122],[698,134],[618,134]]), .05, bk, 0, .0015);
  g.userData.mz = tip; g.userData.by = .03;
  return sy;
}

/* ===== weapon catalogue (49 guns) ===== */
WD('knife','Melee','Combat Knife',55,.45,1,0,1,0,0,70,{f:'m',p:{t:'knife'},melee:1,range:2.3,mv:1.12,hip:[.2,-.2,-.38]});
WD('axe','Melee','Tomahawk',85,.75,1,0,1,0,0,70,{f:'m',p:{t:'axe'},melee:1,range:2.5,mv:1.05,hip:[.2,-.2,-.38]});
WD('machete','Melee','Machete',70,.6,1,0,1,0,0,70,{f:'m',p:{t:'machete'},melee:1,range:2.9,mv:1.05,hip:[.2,-.2,-.38]});
WD('katana','Melee','Katana',95,.65,1,0,1,0,0,70,{f:'m',p:{t:'katana'},melee:1,range:3.2,mv:1.08,hip:[.2,-.2,-.4]});
WD('bat','Melee','Baseball Bat',60,.7,1,0,1,0,0,70,{f:'m',p:{t:'bat'},melee:1,range:2.9,mv:1.05,hip:[.2,-.22,-.4]});
WD('crowbar','Melee','Crowbar',65,.65,1,0,1,0,0,70,{f:'m',p:{t:'crowbar'},melee:1,range:2.6,mv:1.05,hip:[.2,-.22,-.4]});
WD('glock','Pistol','Glock 17',22,.12,17,1.4,0,.022,.6,60,{f:'p',p:{sl:.19,sh:.03},hip:HP,snd:[260,.1]});
WD('m1911','Pistol','M1911',30,.17,8,1.5,0,.018,.8,60,{f:'p',p:{sl:.2,sh:.032,hammer:1,steel:1,wg:1},hip:HP,snd:[240,.11]});
WD('m9','Pistol','Beretta M9',23,.14,15,1.5,0,.02,.65,60,{f:'p',p:{sl:.217,sh:.034,sw:.032},hip:HP,snd:[250,.1]});
WD('usp','Pistol','HK USP',26,.15,12,1.5,0,.018,.7,60,{f:'p',p:{sl:.205,sh:.033,sw:.033},hip:HP,snd:[245,.1]});
WD('fn57','Pistol','FN Five-seveN',24,.11,20,1.6,0,.017,.5,60,{f:'p',p:{sl:.208,sh:.03,sw:.03},hip:HP,snd:[300,.09]});
WD('mak','Pistol','Makarov PM',20,.15,8,1.4,0,.025,.7,60,{f:'p',p:{sl:.16,sh:.03,sw:.028},hip:HP,snd:[230,.1]});
WD('deagle','Pistol','Desert Eagle',64,.45,7,1.9,0,.02,1.9,58,{f:'p',p:{sl:.27,sh:.05,sw:.036,steel:1},hip:[.15,-.17,-.34],snd:[150,.22]});
WD('python','Pistol','Colt Python .357',80,.6,6,2.7,0,.016,2.3,58,{f:'v',p:{},hip:[.15,-.17,-.34],snd:[130,.24]});
WD('g18','Pistol','Glock 18 Auto',14,.055,33,1.7,1,.05,.65,60,{f:'p',p:{sl:.19,sh:.03},hip:HP,snd:[260,.08]});
WD('mp5','SMG','MP5',20,.075,30,1.9,1,.03,.5,58,{f:'r',p:{rl:.24,rh:.07,rw:.045,poly:1,hg:['round',.12],bl:.1,mzt:'fh',st:['fix',.2],mag:['ak',.1]},hip:[.18,-.19,-.38]});
WD('uzi','SMG','Uzi',18,.065,32,1.8,1,.04,.55,58,{f:'r',p:{rl:.26,rh:.06,rw:.05,bl:.1,mzt:'none',st:['fold',.22],mag:['stk',.2],mgz:.06,gr:0,gz:.07},hip:[.18,-.18,-.36]});
WD('p90','SMG','FN P90',17,.056,50,2.3,1,.03,.4,56,{f:'r',p:{rl:.3,rh:.1,rw:.06,poly:1,bl:.03,mzt:'fh',topmag:1,sight:'dot',gr:0},hip:[.18,-.19,-.36]});
WD('vector','SMG','KRISS Vector',16,.045,33,1.7,1,.035,.35,58,{f:'r',p:{rl:.24,rh:.1,rw:.05,poly:1,hg:['box',.08],bl:.06,mzt:'sup',st:['skel',.2],mag:['stk',.17],mgz:.03},hip:[.18,-.19,-.38]});
WD('mac10','SMG','MAC-10',14,.05,30,1.6,1,.06,.8,60,{f:'r',p:{rl:.14,rh:.095,rw:.055,bl:.06,mzt:'fh',st:['fold',.16],mag:['stk',.15],mgz:.04,gr:0,gz:.04},hip:[.17,-.18,-.34]});
WD('mp7','SMG','HK MP7',18,.06,40,1.8,1,.025,.4,58,{f:'r',p:{rl:.22,rh:.075,rw:.04,poly:1,rail:1,bl:.1,mzt:'sup',st:['m4',.17],mag:['stk',.14]},hip:[.18,-.19,-.36]});
WD('ump','SMG','HK UMP45',24,.09,25,1.9,1,.03,.7,58,{f:'r',p:{rl:.26,rh:.08,rw:.045,poly:1,rail:1,hg:['box',.1],bl:.08,mzt:'fh',st:['fold',.2],mag:['stk',.15]},hip:[.18,-.19,-.36]});
WD('skorp','SMG','Skorpion vz.61',14,.05,20,1.5,1,.05,.7,60,{f:'r',p:{rl:.14,rh:.07,rw:.04,bl:.08,mzt:'none',st:['fold',.16],mag:['stk',.1],mgz:.03,gr:0,gz:.035},hip:[.17,-.18,-.34]});
WD('ak','Rifle','AK-47',30,.1,30,2,1,.02,1,52,{f:'r',p:{rl:.3,rh:.07,rw:.048,ak:1,hg:['wood',.2],gas:1,bl:.22,mzt:'ak',st:['wood',.25],mag:['ak',.1]}});
WD('ak74u','Rifle','AKS-74U',26,.085,30,1.8,1,.035,1,54,{f:'r',p:{rl:.26,rh:.065,rw:.046,ak:1,hg:['wood',.1],gas:1,bl:.1,mzt:'ak',st:['fold',.22],mag:['ak',.1]}});
WD('m4','Rifle','M4A1 Carbine',28,.08,30,1.9,1,.022,.8,52,{f:'r',p:{rl:.3,rh:.072,rw:.044,poly:1,rail:1,hg:['round',.22],bl:.12,mzt:'fh',st:['m4',.2],mag:['stk',.17],sight:'carry'}});
WD('hk416','Rifle','HK416',29,.08,30,1.9,1,.02,.75,52,{f:'r',p:{rl:.3,rh:.072,rw:.044,poly:1,rail:1,hg:['round',.26],bl:.1,mzt:'fh',st:['m4',.2],mag:['stk',.17]}});
WD('m16','Rifle','M16A4',30,.09,30,2,1,.018,.85,50,{f:'r',p:{rl:.3,rh:.072,rw:.044,poly:1,hg:['round',.3],bl:.28,mzt:'fh',st:['fix',.26],mag:['stk',.17],sight:'carry'}});
WD('scar','Rifle','SCAR-H',38,.11,20,2.1,1,.022,1.2,50,{f:'r',p:{rl:.34,rh:.08,rw:.05,tan:1,rail:1,hg:['round',.2],bl:.18,mzt:'fh',st:['fix',.26],mag:['stk',.17]}});
WD('aug','Rifle','Steyr AUG',27,.082,30,2,1,.02,.6,38,{f:'r',p:{rl:.5,rh:.09,rw:.052,poly:1,bl:.22,mzt:'fh',mag:['stk',.15],mgz:.1,gz:-.04,tz:-.1,sight:'scope',sl:.14,sz:-.05}});
WD('g36','Rifle','HK G36',26,.084,30,2,1,.022,.7,50,{f:'r',p:{rl:.3,rh:.08,rw:.048,poly:1,hg:['round',.17],bl:.2,mzt:'fh',st:['fix',.25],mag:['box',.16],sight:'carry'}});
WD('g3','Rifle','HK G3',38,.1,20,2.2,1,.025,1.3,50,{f:'r',p:{rl:.32,rh:.075,rw:.048,hg:['wood',.2],bl:.2,mzt:'fh',st:['fix',.27],mag:['ak',.1]}});
WD('famas','Rifle','FAMAS',27,.075,25,2,1,.02,.6,44,{f:'r',p:{rl:.5,rh:.1,rw:.05,poly:1,bl:.2,mzt:'fh',mag:['stk',.14],mgz:.12,gz:-.03,tz:-.09,sight:'scope',sl:.1,sz:-.1}});
WD('rem870','Shotgun','Remington 870',15,.95,6,2.8,0,.055,2.4,62,{f:'s',p:{t:'pump'},pel:9,snd:[110,.25]});
WD('spas','Shotgun','SPAS-12',14,.45,8,2.8,0,.055,2.3,62,{f:'s',p:{t:'spas'},pel:9,snd:[110,.25]});
WD('dbl','Shotgun','Double Barrel',17,.3,2,2.2,0,.06,3,62,{f:'s',p:{t:'dbl'},pel:12,snd:[100,.28]});
WD('benelli','Shotgun','Benelli M4',15,.5,7,2.6,0,.05,2.1,62,{f:'s',p:{t:'spas'},pel:9,snd:[110,.25]});
WD('aa12','Shotgun','AA-12',11,.2,20,3.2,1,.065,1.4,62,{f:'s',p:{t:'aa'},pel:8,snd:[115,.2]});
WD('m249','MG','M249 SAW',28,.075,100,5.5,1,.045,.9,54,{f:'r',p:{rl:.4,rh:.09,rw:.06,poly:1,hg:['round',.16],bl:.33,bw:.011,mzt:'fh',st:['fix',.27],mgbox:1,bipod:1,carry:1},mv:.8,hip:[.2,-.22,-.36]});
WD('pkm','MG','PKM',36,.09,100,5.8,1,.05,1.3,54,{f:'r',p:{rl:.45,rh:.1,rw:.06,hg:['round',.17],bl:.4,bw:.011,mzt:'fh',st:['wood',.28],mgbox:1,bipod:1,carry:1},mv:.78,hip:[.2,-.22,-.36],snd:[140,.16]});
WD('rpk','MG','RPK',30,.09,75,4.5,1,.04,1.1,54,{f:'r',p:{rl:.3,rh:.07,rw:.048,ak:1,hg:['wood',.22],gas:1,bl:.42,mzt:'ak',st:['wood',.25],mag:['ak',.14],bipod:1},mv:.85,hip:[.2,-.21,-.4]});
WD('minigun','MG','M134 Minigun',15,.028,200,7,1,.07,.45,60,{f:'g',p:{},spin:1,mv:.5,hip:[.12,-.3,-.5],snd:[150,.1]});
WD('svd','Sniper','Dragunov SVD',70,.38,10,2.6,0,.05,1.8,22,{f:'r',p:{rl:.28,rh:.065,rw:.045,hg:['wood',.22],gas:1,bl:.38,mzt:'fh',st:['wskel',.3],mag:['ak',.1],sight:'scope',sl:.2},scope:1});
WD('kar98','Sniper','Kar98k',100,1.2,5,3,0,.04,2.2,16,{f:'r',p:{rl:.32,rh:.065,rw:.04,hg:['wood',.3],bl:.4,mzt:'none',st:['wood',.3],mag:['stk',.03],sight:'scope',sl:.22,bolt:1,gr:0},scope:1,hip:[.19,-.21,-.45]});
WD('mosin','Sniper','Mosin-Nagant',95,1.1,5,3.2,0,.04,2.2,16,{f:'r',p:{rl:.32,rh:.065,rw:.04,hg:['wood',.3],bl:.45,mzt:'none',st:['wood',.3],mag:['stk',.03],sight:'scope',sl:.2,bolt:1,gr:0},scope:1,hip:[.19,-.21,-.45]});
WD('sr25','Sniper','SR-25',60,.3,10,2.4,0,.03,1.2,18,{f:'r',p:{rl:.32,rh:.075,rw:.046,poly:1,rail:1,hg:['round',.28],bl:.3,mzt:'fh',st:['fix',.26],mag:['stk',.14],sight:'scope',sl:.3,bipod:1},scope:1,hip:[.19,-.21,-.45]});
WD('avm','Sniper','AVM (AWM)',110,1.3,5,2.8,0,.05,2.4,14,{f:'r',p:{rl:.4,rh:.08,rw:.05,poly:1,hg:['round',.2],bl:.5,mzt:'brake',st:['fix',.3],mag:['stk',.07],sight:'scope',sl:.32,bolt:1,bipod:1},scope:1,hip:[.19,-.21,-.45]});
WD('m24','Sniper','M24 SWS',120,1.5,5,3.2,0,.045,2.2,12,{f:'r',p:{rl:.3,rh:.07,rw:.045,bl:.55,mzt:'fh',st:['wood',.3],mag:['stk',.05],sight:'scope',sl:.34,bolt:1},scope:1,hip:[.19,-.21,-.45]});
WD('barrett','Sniper','Barrett M82',150,.9,10,3.8,0,.06,3.5,12,{f:'r',p:{rl:.5,rh:.1,rw:.06,poly:1,hg:['round',.2],bl:.55,bw:.016,mzt:'brake',st:['fix',.22],mag:['stk',.1],sight:'scope',sl:.35,bipod:1},scope:1,mv:.85,hip:[.19,-.22,-.45],snd:[70,.4]});
W.avm.f = 'a'; W.avm.p = {};

const ALL = ORDER.slice().sort((a,b) => CATS.indexOf(W[a].cat) - CATS.indexOf(W[b].cat));
ORDER.length = 0; ORDER.push('knife','glock');
let cur = 'glock', gun = null, curSy = .06;

/* ===== buildGun / setGun / stats ===== */
const gunRoot = new T.Group(); cam.add(gunRoot);
const flashM = new T.Mesh(new T.SphereGeometry(.04,8,8), new T.MeshBasicMaterial({color:0xffb050,transparent:true,opacity:.9}));
flashM.visible = false;
const flashL = new T.PointLight(0xffa550, 0, 7);
gunRoot.add(flashM, flashL);
const camL = new T.PointLight(0x9fb0c0, .35, 6); camL.position.set(.2,.2,-.2); cam.add(camL);

function stats(id){
  const w = W[id], a = inv[id].at;
  return {mag: Math.round(w.mag * (a.mag?1.5:1)), rec: w.rec * (a.muzzle?.55:1), fov: w.fov * (a.holo && !w.scope ? .82 : 1)};
}
function buildGun(id, at, nh){
  const w = W[id], g = new T.Group(); g.userData = {};
  const F = {r:rifle, p:pistol, v:revolver, s:shotgun, g:minigun, m:melee, a:awm};
  g.userData.sy = F[w.f](g, w.p, at);
  if (!nh){
    addGripMarkers(g, w);
    g.updateMatrixWorld(true);
    const mag = findMagMesh(g, w);
    if (mag){
      const bb = new T.Box3().setFromObject(mag), cl = bb.getCenter(new T.Vector3());
      mag.geometry.translate(-cl.x, -cl.y, -cl.z);
      mag.position.set(cl.x, cl.y, cl.z);
      mag.userData.isMag = true; mag.userData.home = cl.clone();
      g.userData.magMesh = mag;
    }
  }
  return g;
}
function setGun(){
  if (gun){ gun.traverse(o => o.geometry && o.geometry.dispose()); gunRoot.remove(gun); }
  gun = buildGun(cur, inv[cur].at, 0);
  gunRoot.add(gun);
  curSy = gun.userData.sy;
  flashM.position.set(0, gun.userData.by || 0, (gun.userData.mz || -.5) - .04);
  flashL.position.copy(flashM.position);
  flashM.visible = false;
}

/* ===== effects ===== */
const sparkG = new T.BoxGeometry(.06,.06,.06), sparkM = new T.MeshBasicMaterial({color:0xffb860});
function spark(pt, h){
  const s = new T.Mesh(sparkG, sparkM); s.position.copy(pt); scene.add(s);
  fxs.push({m:s, t:.15});
  if (h && h.face){
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    const d = new T.Mesh(new T.CircleGeometry(.05 + R()*.03, 8), holeM);
    d.position.copy(pt).addScaledVector(n, .012);
    d.lookAt(pt.clone().add(n));
    scene.add(d); decals.push(d);
    if (decals.length > 70){ const o = decals.shift(); scene.remove(o); o.geometry.dispose(); }
  }
}
function tracer(a, b, col){
  const l = new T.Line(new T.BufferGeometry().setFromPoints([a,b]), new T.LineBasicMaterial({color:col, transparent:true, opacity:.8}));
  scene.add(l); fxs.push({m:l, t:.07, tr:1});
}

/* ===== IK hands (from v7) ===== */
const ARM_UP = 0.36, ARM_LO = 0.32;
function buildFingerSeg(len, r){
  const m = new T.Mesh(new T.CylinderGeometry(r, r*.82, len, 6), M.glove);
  m.geometry.translate(0, len/2, 0); return m;
}
function buildFinger(){
  const root = new T.Group();
  const s1 = buildFingerSeg(.026, .0075); root.add(s1);
  const j2 = new T.Group(); j2.position.y = .026; s1.add(j2);
  const s2 = buildFingerSeg(.022, .0065); j2.add(s2);
  const j3 = new T.Group(); j3.position.y = .022; s2.add(j3);
  const s3 = buildFingerSeg(.017, .0055); j3.add(s3);
  return {root, joints: [s1, j2, j3]};
}
function buildHand(side){
  const g = new T.Group();
  const palm = new T.Mesh(new T.BoxGeometry(.058,.022,.078), M.glove);
  palm.position.set(0,-.008,-.022); g.add(palm);
  const back = new T.Mesh(new T.BoxGeometry(.06,.008,.08), M.glove);
  back.position.set(0,.004,-.022); g.add(back);
  const fingers = [];
  for(let i=0;i<4;i++){
    const f = buildFinger();
    f.root.position.set((i-1.5)*.0145, -.002, -.058);
    f.root.rotation.x = -PI/2 + .22;
    g.add(f.root); fingers.push(f);
  }
  const th = buildFinger();
  th.root.position.set(side*.027, -.008, -.008);
  th.root.rotation.set(-PI/2 + .3, 0, side*-.95);
  g.add(th.root); fingers.push(th);
  return {g, fingers};
}
const handsRig = new T.Group(); cam.add(handsRig);
function buildArm(side){
  const upper = new T.Mesh(new T.CylinderGeometry(.05,.042,1,10), M.sleeve);
  upper.geometry.translate(0,.5,0); upper.scale.y = ARM_UP; handsRig.add(upper);
  const fore = new T.Mesh(new T.CylinderGeometry(.041,.034,1,10), M.sleeve);
  fore.geometry.translate(0,.5,0); fore.scale.y = ARM_LO; handsRig.add(fore);
  const cuff = new T.Mesh(new T.CylinderGeometry(.038,.036,.055,10), M.glove);
  cuff.geometry.translate(0,.028,0); handsRig.add(cuff);
  const hand = buildHand(side); handsRig.add(hand.g);
  return {
    upper, fore, cuff, hand, side,
    shoulder: new T.Vector3(side*.18, -.32, .06),
    _v1: new T.Vector3(), _v2: new T.Vector3(), _v3: new T.Vector3(),
    solve(target, gunQuat, curl){
      const S = this.shoulder, L1 = ARM_UP, L2 = ARM_LO;
      const dir = this._v1.copy(target).sub(S);
      let d = clamp(dir.length(), Math.abs(L1-L2)+.02, L1+L2-.02);
      dir.normalize();
      const T2 = this._v2.copy(S).addScaledVector(dir, d);
      const pole = this._v3.set(side*.9, -.55, .15).normalize();
      const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const a = (L1*L1 - L2*L2 + d*d)/(2*d);
      const h = Math.sqrt(Math.max(0, L1*L1 - a*a));
      const E = new T.Vector3().copy(S).addScaledVector(dir, a).addScaledVector(perp, h);
      const upDir = E.clone().sub(S).normalize();
      this.upper.position.copy(S);
      this.upper.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), upDir);
      const foreDir = T2.clone().sub(E).normalize();
      this.fore.position.copy(E);
      this.fore.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), foreDir);
      this.cuff.position.copy(T2); this.cuff.quaternion.copy(this.fore.quaternion);
      this.hand.g.position.copy(T2);
      const gunFwd = new T.Vector3(0,0,-1).applyQuaternion(gunQuat).normalize();
      const gunUp = new T.Vector3(0,1,0).applyQuaternion(gunQuat).normalize();
      const gunRight = new T.Vector3().crossVectors(gunUp, gunFwd).normalize();
      const basis = new T.Matrix4().makeBasis(gunRight, gunUp.clone().negate(), gunFwd);
      this.hand.g.quaternion.setFromRotationMatrix(basis);
      this.hand.fingers.forEach((f,i) => {
        const amt = i === 4 ? curl*.62 : curl;
        f.joints[0].rotation.x = amt*1.15;
        f.joints[1].rotation.x = amt*1.35;
        f.joints[2].rotation.x = amt*1.05;
      });
    },
    hide(){ this.upper.visible = this.fore.visible = this.cuff.visible = this.hand.g.visible = false; },
    show(){ this.upper.visible = this.fore.visible = this.cuff.visible = this.hand.g.visible = true; }
  };
}
const armR = buildArm(1), armL = buildArm(-1);

function addGripMarkers(g, w){
  const p = w.p || {};
  let Rp, Lp;
  if (w.f==='a'){ Rp = new T.Vector3(0,-.055,.125); Lp = new T.Vector3(0,-.035,-.17); }
  else if (w.f==='r'){ const t=p.rh/2, sz=p.rl/2, gz=p.gz!==undefined?p.gz:sz-.06, hl=p.hg?p.hg[1]:.08; Rp = new T.Vector3(0,-t-.05,gz+.012); Lp = new T.Vector3(0,-.034,-(sz+Math.max(hl*.55,.06))); }
  else if (w.f==='p'){ const y0=-p.sh/2; Rp = new T.Vector3(0,y0-.065,.03); Lp = new T.Vector3(-.012,y0-.105,.025); }
  else if (w.f==='v'){ Rp = new T.Vector3(0,-.065,.07); Lp = new T.Vector3(-.012,-.1,.075); }
  else if (w.f==='s'){ Rp = new T.Vector3(0,-.05,p.t==='pump'?.17:.1); Lp = new T.Vector3(0,-.035,-.27); }
  else if (w.f==='g'){ Rp = new T.Vector3(0,-.1,.12); Lp = new T.Vector3(0,-.1,-.02); }
  else { Rp = new T.Vector3(0,0,.08); Lp = null; }
  const mr = new T.Object3D(); mr.position.copy(Rp); g.add(mr); g.userData.gripR = mr;
  if (Lp){ const ml = new T.Object3D(); ml.position.copy(Lp); g.add(ml); g.userData.gripL = ml; }
  else g.userData.gripL = null;
}
function findMagMesh(g, w){
  const p = w.p || {};
  if (!p.mag || p.mag[0]==='none') return null;
  const rl = p.rl, t = p.rh/2, mz0 = p.mgz !== undefined ? p.mgz : -rl*.08;
  const target = new T.Vector3(0, -t-.10, mz0);
  let best = null, bestD = .09;
  g.traverse(c => {
    if (!c.isMesh || !c.geometry) return;
    if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
    const ctr = new T.Vector3(); c.geometry.boundingBox.getCenter(ctr);
    const d = ctr.distanceTo(target);
    if (d < bestD){ bestD = d; best = c; }
  });
  return best;
}

function startMagCheck(){
  if (P.magCheck > 0 || reloadT > 0 || state === 'dead' || shopOpen || !isLocked()) return;
  if (!gun || !gun.userData.magMesh) return;
  const mag = gun.userData.magMesh;
  gun.remove(mag); handsRig.add(mag);
  P.magMesh = mag; P.magCheck = 1.6;
  sfx(220, .08, .04);
}

const _wp = new T.Vector3(), _wqGun = new T.Quaternion(), _wqCam = new T.Quaternion(), _localQ = new T.Quaternion();
function updateHands(dt){
  if (!gun || !gun.userData.gripR){ armR.hide(); armL.hide(); return; }
  cam.updateMatrixWorld(true);
  gun.getWorldQuaternion(_wqGun); cam.getWorldQuaternion(_wqCam);
  _localQ.copy(_wqCam).invert().multiply(_wqGun);
  gun.userData.gripR.getWorldPosition(_wp); cam.worldToLocal(_wp);
  let curlR = 1.0;
  if (reloadT > 0){ const t = 1 - reloadT/W[cur].rl; curlR = .9 - .35*Math.sin(PI*t); }
  armR.solve(_wp, _localQ, curlR); armR.show();
  if (!gun.userData.gripL){
    armL.hide();
    if (P.magMesh) P.magMesh.visible = false;
  } else {
    gun.userData.gripL.getWorldPosition(_wp); cam.worldToLocal(_wp);
    let off = new T.Vector3(), curlL = .9;
    if (reloadT > 0){ const t = 1 - reloadT/W[cur].rl, grab = Math.sin(PI*clamp((t-.08)/.72,0,1)); off.y -= .2*grab; off.z += .05*grab; curlL = .85 - .55*grab; }
    if (P.magCheck > 0){ const t = 1 - P.magCheck/1.6, grab = Math.sin(PI*clamp((t-.05)/.85,0,1)); off.y -= .24*grab; off.z += .06*grab; curlL = .75 + .2*grab; }
    if (P.insp > 0){ const t = 1 - P.insp, rel = Math.sin(PI*clamp((t-.15)/.65,0,1)); off.y -= .035*rel; curlL = .9 - .45*rel; }
    _wp.add(off); armL.solve(_wp, _localQ, curlL); armL.show();
  }
  if (P.magCheck > 0 && P.magMesh){
    P.magMesh.visible = true;
    P.magMesh.position.copy(armL.hand.g.position).add(new T.Vector3(0,-.055,.01));
    P.magMesh.quaternion.copy(armL.hand.g.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), .6));
    P.magCheck -= dt;
    if (P.magCheck <= 0){
      handsRig.remove(P.magMesh); gun.add(P.magMesh);
      P.magMesh.position.copy(P.magMesh.userData.home);
      P.magMesh.quaternion.identity();
      P.magMesh = null; P.magCheck = 0;
      sfx(420, .06, .05);
    }
  }
}

/* ===== fire / reload / switch ===== */
function startReload(){
  const w = W[cur];
  if (reloadT > 0 || inv[cur].ammo >= stats(cur).mag) return;
  reloadT = w.rl; sfx(400, .1, .05);
}
const ray = new T.Raycaster();
function tryFire(){
  const w = W[cur], i = inv[cur], st = stats(cur);
  if (fireCd > 0 || reloadT > 0 || P.slide > .45 || P.sw > .5) return;
  const tg = blockers.concat(bot && bot.alive ? bot.hit : []);
  if (w.melee){
    fireCd = w.rate; P.swing = 1; sfx(320, .08, .05);
    const d = new T.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
    ray.set(cam.position, d); ray.far = w.range;
    const h = ray.intersectObjects(tg, false)[0];
    if (h){
      const part = h.object.userData.part;
      if (part){ const c = part === 'head'; hurtBot(w.dmg * (c?2:1), c, h.point); sfx(120, .1, .1); }
      else spark(h.point, h);
    }
    return;
  }
  if (w.spin && P.spin < .85) return;
  if (i.ammo <= 0){ startReload(); return; }
  i.ammo--; fireCd = w.rate;
  P.kick = Math.min(P.kick + .5*st.rec, 1.6);
  P.ck = Math.min(P.ck + .005*st.rec*(1-P.ads*.4), .06);
  P.pitch += .0015*st.rec;
  flashT = .05; P.n++;
  if (!w.spin || P.n % 3 === 0) sfx(w.snd[0], w.snd[1], .12);
  const spr = w.spr * (1-.75*P.ads) * (1 + Math.min(P.vel.length()/12, .5));
  const org = cam.position;
  for(let k=0;k<w.pel;k++){
    const d = new T.Vector3((R()-.5)*2*spr, (R()-.5)*2*spr, -1).normalize().applyQuaternion(cam.quaternion);
    ray.set(org, d); ray.far = 150;
    const h = ray.intersectObjects(tg, false)[0];
    const end = h ? h.point : org.clone().addScaledVector(d, 80);
    if (!w.spin || P.n % 2) tracer(cam.localToWorld(new T.Vector3(.12-.12*P.ads, -.1+.1*P.ads, -.8)), end, 0xffd890);
    if (h){
      const part = h.object.userData.part;
      if (part){
        const crit = part === 'head';
        let dm = w.dmg;
        if (w.pel > 1) dm *= clamp(1.3 - h.distance/25, .3, 1);
        if (crit) dm *= 2.5;
        hurtBot(dm, crit, h.point);
      } else spark(h.point, h);
    }
  }
}
function selWeapon(id){
  if (id === cur || !W[id]) return;
  cur = id; reloadT = 0; P.sw = 1; P.spin = 0; setGun();
  toast(W[id].cat + ' \u00b7 ' + W[id].n);
}
const cyc = d => selWeapon(ORDER[(ORDER.indexOf(cur) + d + ORDER.length) % ORDER.length]);

/* ===== weapon animations ===== */
const ss = (a,b,t) => { t = clamp((t-a)/(b-a), 0, 1); return t*t*(3-2*t); };
function pose(st, t, k){
  const hu = (a,b) => Math.sin(PI*ss(a,b,t));
  switch(st){
    case 'flip':{ const a=ss(.15,.6,t), pre=ss(0,.15,t)*(1-ss(.6,.85,t)); return [0, -.07*pre+.3*Math.sin(PI*a), .06*Math.sin(PI*a), -k*PI*2*a+.35*pre, 0, .3*pre]; }
    case 'flipz':{ const a=ss(.15,.6,t), pre=ss(0,.15,t)*(1-ss(.6,.85,t)); return [0, -.05*pre+.26*Math.sin(PI*a), .05*Math.sin(PI*a), .2*pre, 0, -k*PI*2*a]; }
    case 'smg':{ const a=ss(.2,.6,t), pre=ss(0,.2,t)*(1-ss(.6,.9,t)); return [-.04*pre, -.1*pre, .05*pre, .25*pre, .3*Math.sin(PI*a), .5*pre-(k>1?PI*2*a:0)]; }
    case 'tilt':{ const a=hu(.1,.9); return [.03*a, -.09*a, .04*a, .2*a, .1*a, .55*a*k]; }
    case 'drop':{ const a=hu(.08,.55)+hu(.55,.95)*.6; return [-.05*a, -.13*a*k, .05*a, .15*a, -.12*a, -.4*a]; }
    case 'bolt':{ const a=hu(.08,.92), b=Math.sin(PI*2*ss(.35,.75,t))*.5; return [.02*a, -.05*a, .03*a+.04*b, .1*a, 0, .65*a*k]; }
    case 'pump':{ const a=hu(.05,.85), b=Math.abs(Math.sin(PI*3*ss(.2,.8,t))); return [.04*a, -.06*a-.05*b, .04*a, .55*a, 0, .45*a*k]; }
    case 'break':{ const a=hu(.1,.9), sn=ss(.85,.95,t); return [0, -.06*a, .02*a, .7*a*(1-sn), 0, .3*a]; }
    case 'spin':{ const a=hu(.1,.9), wb=Math.sin(PI*8*ss(.5,.85,t))*.12; return [-.03*a, -.08*a, 0, .5*a, wb, -.7*a+wb]; }
    case 'box':{ const a=hu(.05,.95), sh=Math.sin(PI*6*t)*.01; return [-.02*a+sh, -.12*a, .06*a, .1*a, .15*a, -.35*a*k]; }
    case 'bull':{ const a=hu(.1,.9); return [.02*a, -.1*a, .03*a, .25*a, 0, .35*a]; }
    case 'minig':{ const a=hu(.05,.95); return [0, -.06*a+Math.sin(PI*10*t)*.004, .03*a, .12*a, 0, -.2*a]; }
  }
  return [0,0,0,0,0,0];
}
const RA = {
  glock:['flip',1], m1911:['flip',2], m9:['flipz',1], usp:['flip',1], fn57:['flip',2], mak:['flipz',2], deagle:['flip',1], python:['spin',1], g18:['flip',1],
  mp5:['smg',1], uzi:['smg',2], p90:['tilt',.8], vector:['smg',2], mac10:['flipz',1], mp7:['drop',.9], ump:['smg',1], skorp:['flip',1],
  ak:['tilt',1], ak74u:['tilt',1.2], m4:['drop',1], hk416:['drop',1.2], m16:['drop',.8], scar:['tilt',.8], aug:['bull',1], g36:['drop',1], g3:['tilt',.9], famas:['bull',1.2],
  rem870:['pump',1], spas:['pump',1.2], dbl:['break',1], benelli:['pump',.9], aa12:['drop',.7], m249:['box',1], pkm:['box',1.2], rpk:['tilt',.6], minigun:['minig',1],
  svd:['tilt',.7], kar98:['bolt',1], mosin:['bolt',1.2], sr25:['drop',.8], avm:['bolt',1], m24:['bolt',1.1], barrett:['box',.5]
};

function gunExtra(dt){
  const w = W[cur];
  // base positioning
  const spd = Math.hypot(P.vel.x, P.vel.z);
  const k = P.ads, sw = 1 - k*.85;
  const dip = reloadT > 0 ? Math.sin(PI*(1 - reloadT/w.rl)) : 0;
  gunRoot.position.set(
    w.hip[0]*(1-k) + clamp(P.msx,-.03,.03)*sw + Math.sin(P.bob)*.006*sw*Math.min(spd/6,1),
    w.hip[1]*(1-k) - curSy*k + clamp(P.msy,-.03,.03)*sw + Math.abs(Math.cos(P.bob))*.006*sw*Math.min(spd/6,1) - dip*.14 - (P.slide>0?.05:0) + P.kick*.012,
    w.hip[2] + P.kick*.05
  );
  gunRoot.rotation.set(P.kick*.09 + dip*.55, 0, P.tilt*2.5 - dip*.35);

  // animation timers
  P.sw = Math.max(0, P.sw - dt*((w.cat==='Pistol'||w.melee)?2.2:4.5));
  P.swing = Math.max(0, P.swing - dt/(w.rate||.5)*1.2);
  P.th = Math.max(0, P.th - dt*3);
  P.insp = Math.max(0, P.insp - dt/2.6);

  if (w.spin){
    const on = mouse && inv[cur].ammo > 0 && reloadT <= 0;
    P.spin = clamp(P.spin + (on ? dt*1.5 : -dt*1.1), 0, 1);
    if (gun.userData.rot) gun.userData.rot.rotation.z += P.spin*dt*40;
  }

  // swing / throw / draw
  const s = Math.sin((1-P.swing)*PI);
  gunRoot.position.z -= s*.35; gunRoot.position.x -= s*.12;
  gunRoot.rotation.x -= s*.8; gunRoot.rotation.y += s*.5;
  gunRoot.position.y -= P.sw*.28 + P.th*.3;
  gunRoot.rotation.x += P.sw*.6 + P.th*.5;
  const dsw = P.sw;
  if (w.cat === 'Pistol') gunRoot.rotation.x -= dsw*dsw*PI*2;
  else if (w.melee) gunRoot.rotation.y += dsw*dsw*PI*2;

  // reload
  if (reloadT > 0){
    const t = 1 - reloadT/w.rl, ra = RA[cur] || ['tilt',1], q = pose(ra[0], t, ra[1]);
    gunRoot.position.x += q[0];
    gunRoot.position.y += q[1] + dip*.14;
    gunRoot.position.z += q[2];
    gunRoot.rotation.x += q[3] - dip*.55;
    gunRoot.rotation.y += q[4];
    gunRoot.rotation.z += q[5] + dip*.35;
  }

  // inspect rotation
  if (P.insp > 0){
    const t = 1 - P.insp, q = ss(0,.15,t)*(1-ss(.85,1,t));
    gunRoot.position.x -= .18*q;
    gunRoot.position.y += .06*q;
    gunRoot.position.z += .1*q;
    gunRoot.rotation.y += PI*2*ss(.15,.85,t);
    gunRoot.rotation.z += .4*Math.sin(PI*2*ss(.15,.85,t))*q;
  }

  // scope / crosshair
  const sc = w.scope && P.ads > .85;
  gunRoot.visible = !sc;
  $('scope').style.opacity = sc ? 1 : 0;
  $('cx').style.opacity = sc ? 0 : 1 - P.ads*.7;

  // movement penalty
  const m = w.mv || 1;
  if (m !== 1 && P.slide <= 0){
    P.pos.x -= P.vel.x*dt*(1-m);
    P.pos.z -= P.vel.z*dt*(1-m);
    collide(P.pos, .4, P.pos.y);
  }

  // IK hands
  updateHands(dt);
}

/* ===== input ===== */
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyF' && P.insp <= 0 && isLocked() && state !== 'dead' && !shopOpen) P.insp = 1;
  if (e.code === 'KeyT') startMagCheck();
  if (!isLocked()) return;
  if (e.code === 'ArrowRight') cyc(1);
  else if (e.code === 'ArrowLeft') cyc(-1);
  else if (e.code.startsWith('Digit')){
    const c = CATS[+e.code[5] - 1];
    if (c){
      const l = ORDER.filter(k => W[k].cat === c), i = l.indexOf(cur);
      if (l.length) selWeapon(l[(i+1) % l.length]);
    }
  }
});
addEventListener('wheel', e => { if (isLocked() && !shopOpen) cyc(e.deltaY > 0 ? 1 : -1); }, {passive:true});

/* ===== diegetic ammo (no floating numbers) ===== */
function updateAmmoHUD(){
  if (W[cur].melee) $('ammo').innerHTML = '<small style="color:#7d8a90">MELEE</small>';
  else $('ammo').innerHTML = '';
}

/* init */
setGun();