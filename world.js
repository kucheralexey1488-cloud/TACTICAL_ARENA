/* world.js — environment: renderer, scene, camera, materials, arena, maps, collision */
const T = THREE, $ = id => document.getElementById(id), R = Math.random, PI = Math.PI;
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const damp  = (a,b,k,dt) => a + (b-a) * (1 - Math.exp(-k*dt));

/* ---- renderer / scene / camera ---- */
const cv = (() => {
  const r = new T.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  r.outputEncoding = T.sRGBEncoding;
  document.body.prepend(r.domElement);
  window.rd = r;
  return r.domElement;
})();
const scene = new T.Scene();
scene.background = new T.Color(0x07080a);
scene.fog = new T.FogExp2(0x07080a, 0.017);
const cam = new T.PerspectiveCamera(75, innerWidth/innerHeight, 0.05, 200);
cam.rotation.order = 'YXZ'; scene.add(cam);
addEventListener('resize', () => {
  rd.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
});

/* ---- procedural texture helpers ---- */
function tex(w, draw, rx, ry){
  const c = document.createElement('canvas'); c.width = c.height = w;
  draw(c.getContext('2d'), w);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.encoding = T.sRGBEncoding; t.anisotropy = 8;
  t.repeat.set(rx || 1, ry || rx || 1);
  return t;
}
const grit = (g,w,n) => { for (let i=0;i<n;i++){ const v=R()<.5?0:255; g.fillStyle=`rgba(${v},${v},${v},${R()*.07})`; g.fillRect(R()*w,R()*w,R()*6+1,R()*6+1); } };
const MT = (c,r=.7,m=.2,o={}) => new T.MeshStandardMaterial(Object.assign({color:c,roughness:r,metalness:m},o));

/* ---- base textures ---- */
const floorT = tex(512,(g,w)=>{
  g.fillStyle='#212328'; g.fillRect(0,0,w,w); grit(g,w,3000);
  g.strokeStyle='#0b0c0e'; g.lineWidth=5; g.strokeRect(0,0,w,w);
  g.strokeStyle='rgba(130,150,160,.16)'; g.lineWidth=1;
  for(let i=1;i<4;i++){ g.beginPath(); g.moveTo(i*w/4,0); g.lineTo(i*w/4,w); g.moveTo(0,i*w/4); g.lineTo(w,i*w/4); g.stroke(); }
});
const wallT = tex(256,(g,w)=>{
  g.fillStyle='#2a2d31'; g.fillRect(0,0,w,w); grit(g,w,1500);
  g.fillStyle='#16181b'; for(let i=0;i<4;i++) g.fillRect(i*64,0,3,w);
  g.fillStyle='#b8942a'; for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(i*32,w-22); g.lineTo(i*32+16,w-22); g.lineTo(i*32+6,w); g.lineTo(i*32-10,w); g.fill(); }
},16,1);
const crateT = tex(256,(g,w)=>{
  g.fillStyle='#363a31'; g.fillRect(0,0,w,w); grit(g,w,2000);
  g.strokeStyle='#191b17'; g.lineWidth=18; g.strokeRect(9,9,w-18,w-18);
  g.lineWidth=6; g.beginPath(); g.moveTo(14,14); g.lineTo(w-14,w-14); g.moveTo(w-14,14); g.lineTo(14,w-14); g.stroke();
  g.fillStyle='#8c7b2c'; g.fillRect(24,w-40,70,8);
});
const mFloor = MT(0xffffff,.82,.25,{map:floorT});
const mWall  = MT(0xffffff,.9,.1,{map:wallT});
const mCrate = MT(0xffffff,.8,.3,{map:crateT});
floorT.repeat.set(26,26);

/* ---- shared materials bundle (used by weapons/hands) ---- */
const woodT = tex(256,(g,w)=>{
  g.fillStyle='#6b3f1e'; g.fillRect(0,0,w,w);
  for(let i=0;i<170;i++){ const y=R()*w;
    g.strokeStyle='rgba('+(R()<.5?'25,12,4':'160,100,55')+','+(.1+R()*.25)+')';
    g.lineWidth=.5+R()*2.2; g.beginPath(); g.moveTo(0,y);
    g.bezierCurveTo(w*.3,y+(R()-.5)*14,w*.7,y+(R()-.5)*14,w,y+(R()-.5)*8); g.stroke(); }
},6,10);
const dots = (n,s) => tex(64,(g,w)=>{
  g.fillStyle='#777'; g.fillRect(0,0,w,w);
  for(let i=0;i<n;i++){ g.fillStyle=R()<.5?'#222':'#ddd'; g.beginPath(); g.arc(R()*w,R()*w,s,0,7); g.fill(); }
},40,40);
const M = {};
M.metal = MT(0x25282c,.38,.92,{bumpMap:dots(700,.7),bumpScale:.25});
M.poly  = MT(0x1d1e20,.62,.05,{bumpMap:dots(420,1.3),bumpScale:.7});
M.wood  = MT(0xffffff,.55,.05,{map:woodT});
M.steel = MT(0x3a3d42,.35,.9);
M.blk   = MT(0x0f1012,.55,.5);
M.tan   = MT(0x6e6048,.7,.15);
M.brass = MT(0xb8923a,.35,.9);
M.gl    = MT(0x3a4540,.4,.2,{transparent:true,opacity:.85});
M.glove = MT(0x17181a,.85,.05,{bumpMap:dots(500,1.2),bumpScale:.6});
M.sleeve= MT(0x4b5238,.95,0,{bumpMap:dots(400,1.5),bumpScale:.5});
M.green = MT(0x6a9a5a,.6,.1,{bumpMap:dots(300,1.4),bumpScale:.4});
M.orange= MT(0xd9742a,.4,.6);
M.blade = MT(0xdde2e6,.18,1);

/* ---- arena ---- */
const AR = 32, obs = [], blockers = [];
const fl = new T.Mesh(new T.PlaneGeometry(AR*2, AR*2), mFloor);
fl.rotation.x = -PI/2; fl.receiveShadow = true; scene.add(fl);
[[0,-AR,AR*2,0],[0,AR,AR*2,0],[-AR,0,0,AR*2],[AR,0,0,AR*2]].forEach(([x,z,w,d])=>{
  const m = new T.Mesh(new T.BoxGeometry(w||1, 8.5, d||1), mWall);
  m.position.set(x, 4.25, z); m.receiveShadow = true; scene.add(m); blockers.push(m);
});
const ceil = new T.Mesh(new T.PlaneGeometry(AR*2,AR*2), new T.MeshBasicMaterial({color:0x08090b}));
ceil.rotation.x = PI/2; ceil.position.y = 8.5; scene.add(ceil);
[[-8,-6,3,2,3],[9,-10,2.5,2.5,2.5],[-14,8,4,1.7,2],[12,9,3,2.2,3],[0,-16,6,2,1.8],[-20,-14,3,3,3],[20,-3,2.5,1.8,5],[-22,0,2,2.5,4],[2,12,2,1.6,2],[-4,2,1.8,1.6,1.8],[24,17,3,2,3],[-10,20,3,2.4,3],[6,-24,3,2,3],[-26,24,3,3,3]]
.forEach(([x,z,w,h,d])=>{
  const m = new T.Mesh(new T.BoxGeometry(w,h,d), mCrate);
  m.position.set(x,h/2,z); m.castShadow = m.receiveShadow = true; scene.add(m); blockers.push(m);
  obs.push({x,z,sx:w,sz:d,h,minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2});
});

/* ---- lights ---- */
scene.add(new T.HemisphereLight(0x8a96a4, 0x15161a, .55));
const hemi = scene.children[scene.children.length-1];
const sun = new T.DirectionalLight(0xcfd8e6, .9);
sun.position.set(18,40,12); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera, {left:-42,right:42,top:42,bottom:-42,far:120});
sun.shadow.bias = -.0005; scene.add(sun);
const ptLights = [];
[[-16,-16,0xbfd4ff],[16,-16,0xffc78a],[-16,16,0xffc78a],[16,16,0xbfd4ff]].forEach(([x,z,c])=>{
  const l = new T.PointLight(c,.8,45); l.position.set(x,7.5,z); scene.add(l); ptLights.push(l);
  const lm = new T.Mesh(new T.CylinderGeometry(.8,.8,.15,12), new T.MeshBasicMaterial({color:c}));
  lm.position.set(x,8.3,z); scene.add(lm);
});

/* ---- environment map for metal reflection ---- */
(() => {
  const pm = new T.PMREMGenerator(rd), es = new T.Scene();
  es.add(new T.Mesh(new T.BoxGeometry(30,30,30), new T.MeshBasicMaterial({color:0x15171b,side:T.BackSide})));
  [[0,14,0,12,.4,12],[-14,5,0,.4,6,16],[14,5,4,.4,4,10],[0,4,-14,14,3,.4]].forEach(([x,y,z,w,h,d])=>{
    const m = new T.Mesh(new T.BoxGeometry(w,h,d), new T.MeshBasicMaterial({color:0xeaf1ff}));
    m.position.set(x,y,z); es.add(m);
  });
  scene.environment = pm.fromScene(es,.04).texture;
})();

/* ---- dust particles ---- */
const dust = (() => {
  const a = new Float32Array(900);
  for(let i=0;i<900;i+=3){ a[i]=(R()-.5)*60; a[i+1]=R()*8; a[i+2]=(R()-.5)*60; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a,3));
  const p = new T.Points(g, new T.PointsMaterial({color:0xa5afb8,size:.06,transparent:true,opacity:.4,depthWrite:false}));
  scene.add(p); return p;
})();

/* ---- arena detail (v6) ---- */
function ob(x,z,sx,sz,h){ obs.push({x,z,sx,sz,h,minx:x-sx/2,maxx:x+sx/2,minz:z-sz/2,maxz:z+sz/2}); }
const concM = MT(0x5a5d61,.95,.05,{bumpMap:floorT,bumpScale:2});
[[-16,-8],[16,-14],[16,3],[-16,14]].forEach(([x,z])=>{
  const c = new T.Mesh(new T.BoxGeometry(1.2,8.5,1.2), concM);
  c.position.set(x,4.25,z); c.castShadow = c.receiveShadow = true; scene.add(c); blockers.push(c);
  ob(x,z,1.2,1.2,8.5);
  const cp = new T.Mesh(new T.BoxGeometry(1.5,.4,1.5), concM); cp.position.set(x,.2,z); scene.add(cp);
});
const drumC = [0x2f4a6b,0x6b2f2f,0x4a5a3a,0x55585c];
[[-5,-21],[18,22],[-24,-6],[4,22]].forEach(([cx,cz])=>{
  for(let i=0;i<3;i++){
    const x=cx+i*.8-.4, z=cz+(i%2)*.7;
    const d = new T.Mesh(new T.CylinderGeometry(.35,.35,1,16), MT(drumC[(i+Math.abs(cx))%4],.5,.6));
    d.position.set(x,.5,z); d.castShadow = d.receiveShadow = true; scene.add(d); blockers.push(d);
    [.2,.8].forEach(y=>{
      const r = new T.Mesh(new T.TorusGeometry(.355,.02,6,20), M.metal);
      r.rotation.x = PI/2; r.position.set(x,y,z); scene.add(r);
    });
    ob(x,z,.7,.7,1);
  }
});
const beamM = MT(0x1c1d20,.6,.7);
for(let i=-3;i<=3;i++){
  const b = new T.Mesh(new T.BoxGeometry(AR*2,.5,.35), beamM); b.position.set(0,8.2,i*10); scene.add(b);
  const c = new T.Mesh(new T.BoxGeometry(.35,.5,AR*2), beamM); c.position.set(i*10,8,0); scene.add(c);
}
[[-16,-16],[16,-16],[-16,16],[16,16]].forEach(([x,z])=>{
  const c = new T.Mesh(new T.ConeGeometry(5,8,24,1,true),
    new T.MeshBasicMaterial({color:0xcfd8e6,transparent:true,opacity:.035,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  c.position.set(x,4.3,z); scene.add(c);
});
const pdM = MT(0x07090c,.04,.85);
for(let i=0;i<7;i++){
  const p = new T.Mesh(new T.CircleGeometry(1+R()*2.2,24), pdM);
  p.rotation.x = -PI/2; p.position.set((R()-.5)*54,.012,(R()-.5)*54); scene.add(p);
}
const lnM = new T.MeshBasicMaterial({color:0xb89a2a,transparent:true,opacity:.45});
[[0,-27.5,56,.15],[0,27.5,56,.15],[-27.5,0,.15,56],[27.5,0,.15,56]].forEach(([x,z,w,d])=>{
  const l = new T.Mesh(new T.BoxGeometry(w,.006,d), lnM); l.position.set(x,.012,z); scene.add(l);
});
const ring5 = new T.Mesh(new T.RingGeometry(5,5.18,64), lnM);
ring5.rotation.x = -PI/2; ring5.position.y = .013; scene.add(ring5);

/* ---- collision ---- */
function collide(p, r, y){
  const pl = (p === P.pos);
  if (pl && p.y > .001) P.onG = false;
  for (const o of obs){
    const b = o.b || 0;
    const cx = clamp(p.x,o.minx,o.maxx), cz = clamp(p.z,o.minz,o.maxz);
    const dx = p.x-cx, dz = p.z-cz, d = Math.hypot(dx,dz);
    if (pl){
      y = p.y;
      if (d < r*.6 && P.vel.y <= 0 && y >= o.h-1 && y <= o.h+.08 && b < o.h-.2){
        p.y = o.h; P.vel.y = 0; P.onG = true; continue;
      }
      if (d < r+.03 && y < o.h && o.h-y <= .5 && y >= b-.05 && P.vel.y <= .1){ p.y = o.h; continue; }
    }
    if (y >= o.h || y+1.8 <= b) continue;
    if (d < r){
      if (d > 1e-4){ p.x = cx+dx/d*r; p.z = cz+dz/d*r; }
      else p.x = o.minx-r;
    }
  }
  p.x = clamp(p.x,-AR+r,AR-r);
  p.z = clamp(p.z,-AR+r,AR-r);
}

/* ---- bullet hole decals (managed here, added by weapon.js) ---- */
const decals = [];
const holeM = new T.MeshBasicMaterial({color:0x040404,transparent:true,opacity:.85,polygonOffset:true,polygonOffsetFactor:-2});

/* ---- map system: warehouse + sandstone ---- */
const sandT = tex(512,(g,w)=>{
  g.fillStyle='#d2b98a'; g.fillRect(0,0,w,w);
  for(let i=0;i<9000;i++){ g.fillStyle='rgba('+(R()<.5?'120,90,50':'255,240,200')+','+R()*.12+')'; g.fillRect(R()*w,R()*w,1+R()*3,1+R()*2); }
  for(let i=0;i<14;i++){ g.strokeStyle='rgba(110,80,40,.08)'; g.lineWidth=2+R()*5; g.beginPath(); const y=R()*w; g.moveTo(0,y); g.bezierCurveTo(w*.3,y+(R()-.5)*60,w*.7,y+(R()-.5)*60,w,y); g.stroke(); }
},18);
const plastT = tex(256,(g,w)=>{
  g.fillStyle='#cdb284'; g.fillRect(0,0,w,w); grit(g,w,2600);
  for(let i=0;i<10;i++){ const x=R()*w,y=R()*w,r=20+R()*50,gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(90,60,30,.18)'); gr.addColorStop(1,'rgba(90,60,30,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); }
  g.strokeStyle='rgba(60,40,20,.25)';
  for(let i=0;i<5;i++){ g.beginPath(); let x=R()*w,y=R()*w; g.moveTo(x,y); for(let k=0;k<6;k++){ x+=(R()-.5)*30; y+=R()*25; g.lineTo(x,y); } g.stroke(); }
},1);
const blockT = tex(256,(g,w)=>{
  g.fillStyle='#8f7650'; g.fillRect(0,0,w,w);
  for(let r=0;r<8;r++) for(let c=-1;c<5;c++){ g.fillStyle='hsl(36,'+(28+R()*10)+'%,'+(56+R()*10)+'%)'; g.fillRect(c*64+(r%2?32:0)+2,r*32+2,60,28); }
  grit(g,w,2500);
},1);
const plankT = tex(256,(g,w)=>{
  g.fillStyle='#2a1a0c'; g.fillRect(0,0,w,w);
  for(let i=0;i<8;i++){ g.fillStyle='hsl(28,'+(35+R()*10)+'%,'+(26+R()*8)+'%)'; g.fillRect(i*32+1,0,30,w);
    for(let k=0;k<14;k++){ g.strokeStyle='rgba(15,8,3,.35)'; g.beginPath(); g.moveTo(i*32+2+R()*26,0); g.lineTo(i*32+2+R()*26,w); g.stroke(); } }
},1);
const tileT = tex(256,(g,w)=>{
  g.fillStyle='#7d6a49'; g.fillRect(0,0,w,w);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++){ g.fillStyle='hsl(38,'+(25+R()*8)+'%,'+(50+R()*8)+'%)'; g.fillRect(i*64+2,j*64+2,60,60); }
  grit(g,w,1800);
},1);
const skyT = (()=>{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#5d8fd0'); gr.addColorStop(.6,'#a9c9ea'); gr.addColorStop(1,'#e8dcc0');
  g.fillStyle = gr; g.fillRect(0,0,2,256);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
})();
const mk = (t,r) => MT(0xffffff,r,0,{map:t,bumpMap:t,bumpScale:1.4});
const mSand = mk(sandT,.97), mPl = mk(plastT,.95), mBk = mk(blockT,.92), mWd = mk(plankT,.8), mTl = mk(tileT,.85), mSb = MT(0xb09a6a,.97,0);

const MAPS = {
  wh:   { n:'Warehouse', start:[0,26],   sp:null },
  sand: { n:'Sandstone', start:[0,28],   sp:[[0,-26],[-8,-22],[5,-20],[-12,-10],[12,-8],[0,-14],[20,-6],[-22,-8],[-4,-6],[4,-6]] }
};
let curMap = 'wh', mapG = null;
const whMeshes = scene.children.filter(o => (o.isMesh || o.isLine) && o !== fl);
const whLights = ptLights.slice();
const whObs = obs.slice();
const whBlk = blockers.slice();

function tile(geo,w,h,d,s){
  const uv = geo.attributes.uv, dm = [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let i=0;i<4;i++){
    const k = f*4+i; uv.setXY(k, uv.getX(k)*dm[f][0]/s, uv.getY(k)*dm[f][1]/s);
  }
}
function bx(x0,z0,x1,z1,y0,y1,mat,nb){
  const w = x1-x0, h = y1-y0, d = z1-z0, geo = new T.BoxGeometry(w,h,d);
  tile(geo,w,h,d,3);
  const m = new T.Mesh(geo,mat); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  m.castShadow = m.receiveShadow = true; mapG.add(m); blockers.push(m);
  if (!nb) obs.push({x:(x0+x1)/2,z:(z0+z1)/2,sx:w,sz:d,h:y1,b:y0,minx:x0,maxx:x1,minz:z0,maxz:z1});
  return m;
}
function wallS(ax,a0,a1,c,t,y0,y1,ops,mat){
  ops = ops.slice().sort((p,q) => p.c-q.c);
  let cur = a0;
  const box = (u0,u1,v0,v1) => ax==='x' ? bx(u0,c-t/2,u1,c+t/2,v0,v1,mat) : bx(c-t/2,u0,c+t/2,u1,v0,v1,mat);
  ops.forEach(o => {
    const s = o.c-o.w/2, e = o.c+o.w/2;
    if (s > cur) box(cur,s,y0,y1);
    if (o.d) box(s,e,y0+2.3,y1);
    else { box(s,e,y0,y0+1); box(s,e,y0+2.1,y1); }
    cur = e;
  });
  if (cur < a1) box(cur,a1,y0,y1);
}
function building(x0,z0,x1,z1,H,y0,o,mat){
  wallS('x',x0,x1,z1-.25,.5,y0,H,o.S||[],mat);
  wallS('x',x0,x1,z0+.25,.5,y0,H,o.N||[],mat);
  wallS('z',z0,z1,x0+.25,.5,y0,H,o.W||[],mat);
  wallS('z',z0,z1,x1-.25,.5,y0,H,o.E||[],mat);
}
function stairs(xa,za,ax,sg,n,w,rise,run,mat){
  for(let i=0;i<n;i++){
    const a0 = i*run, a1 = (i+1)*run;
    if (ax==='z'){ const z0=za+sg*a0, z1=za+sg*a1; bx(xa,Math.min(z0,z1),xa+w,Math.max(z0,z1),0,rise*(i+1),mat); }
    else { const x0=xa+sg*a0, x1=xa+sg*a1; bx(Math.min(x0,x1),za,Math.max(x0,x1),za+w,0,rise*(i+1),mat); }
  }
}
function awn(x,z,w,d,c){
  const m = new T.Mesh(new T.BoxGeometry(w,.06,d), MT(c,.9,0));
  m.position.set(x,2.7,z); m.rotation.x = .1; m.castShadow = true; mapG.add(m);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{
    const p = new T.Mesh(new T.CylinderGeometry(.04,.04,2.7,6), mWd);
    p.position.set(x+a*(w/2-.1),1.35,z+b*(d/2-.1)); mapG.add(p);
  });
}
function buildSand(){
  [[0,-31.7,63.4,.6],[0,31.7,63.4,.6],[-31.7,0,.6,63.4],[31.7,0,.6,63.4]].forEach(([x,z,w,d]) => bx(x-w/2,z-d/2,x+w/2,z+d/2,0,7,mBk,1));
  building(-28,-28,-14,-16,4.2,0,{S:[{c:-21,w:2.4,d:1},{c:-26,w:1.4},{c:-16.5,w:1.4}],E:[{c:-22,w:2.2,d:1}],W:[{c:-22,w:1.4}],N:[{c:-21,w:1.4}]},mPl);
  bx(-28,-28,-14,-16,3.85,4.2,mTl); bx(-28,-28,-14,-27.7,4.2,5.1,mBk); bx(-28,-28,-27.7,-16,4.2,5.1,mBk);
  stairs(-14,-14,'z',-1,14,1.6,.3,.45,mBk);
  building(8,-28,26,-14,3.8,0,{S:[{c:14,w:2.4,d:1},{c:21,w:2.4,d:1},{c:10,w:1.2}],N:[{c:17,w:1.4}],W:[{c:-21,w:1.4}],E:[{c:-21,w:2.2,d:1}]},mPl);
  bx(8,-28,26,-14,3.45,3.8,mTl);
  building(8,-28,26,-14,7.6,3.8,{S:[{c:13,w:2.2,d:1},{c:22,w:1.6}],N:[{c:17,w:1.6}],E:[{c:-20,w:1.6}],W:[{c:-20,w:1.6}]},mPl);
  bx(8,-28,26,-14,7.25,7.6,mTl);
  bx(10,-14,18,-10.5,3.45,3.8,mTl); bx(10,-10.7,18,-10.5,3.8,4.85,mBk);
  bx(10,-14,10.2,-10.5,3.8,4.85,mBk); bx(10,-10.9,10.5,-10.4,0,3.45,mBk); bx(17.5,-10.9,18,-10.4,0,3.45,mBk);
  stairs(18,-5.6,'z',-1,12,1.6,3.8/12,.45,mBk);
  wallS('x',-9,9,-2,.6,0,3,[{c:-4.5,w:3.2,d:1},{c:4.5,w:3.2,d:1}],mBk);
  bx(-9.4,-2.4,-8.6,-1.6,0,3.6,mBk); bx(8.6,-2.4,9.4,-1.6,0,3.6,mBk);
  building(-28,2,-18,12,3.4,0,{N:[{c:-23,w:2.2,d:1}],E:[{c:7,w:2.2,d:1}],S:[{c:-22,w:1.4}]},mPl);
  bx(-28,2,-18,12,3.05,3.4,mTl);
  bx(-20,12,-18.9,13.1,0,1,mWd); bx(-21.1,12,-20,13.1,0,2,mWd); bx(-22.2,12,-21.1,13.1,0,3,mWd);
  bx(-8,9,-4.5,10.2,0,.95,mWd); awn(-6.25,9.6,4.2,2.2,0xa83a2a);
  bx(4,10,7.5,11.2,0,.95,mWd); awn(5.75,10.6,4.2,2.2,0x2a5a8a);
  bx(14,6,15.2,7.2,0,1.2,mWd); bx(15.2,6,16.4,7.2,0,1.2,mWd); bx(14.6,6.2,15.8,7.4,1.2,2.4,mWd);
  bx(22,12,23.4,13.4,0,1.4,mWd);
  bx(-14,20,-8,20.9,0,.9,mSb); bx(8,22,14,22.9,0,.9,mSb);
  bx(-6,-20,-2,-19.6,0,1.5,mBk); bx(2,-12,6,-11.6,0,1.1,mBk); bx(12,-8,17,-7.6,0,1.1,mBk); bx(-24,-8,-20,-7.6,0,1.2,mBk);
  const well = new T.Mesh(new T.CylinderGeometry(1.1,1.2,.9,20), mBk);
  well.position.set(-2,.45,16); well.castShadow = well.receiveShadow = true; mapG.add(well); blockers.push(well);
  obs.push({x:-2,z:16,sx:2.3,sz:2.3,h:.9,minx:-3.15,maxx:-.85,minz:14.85,maxz:17.15});
  [[-12,6],[0,-8],[18,16],[-4,24]].forEach(([x,z],i)=>{
    const d = new T.Mesh(new T.CylinderGeometry(.35,.35,1,14), MT(drumC[i%4],.5,.6));
    d.position.set(x,.5,z); d.castShadow = true; mapG.add(d); blockers.push(d);
    obs.push({x,z,sx:.7,sz:.7,h:1,minx:x-.35,maxx:x+.35,minz:z-.35,maxz:z+.35});
  });
}

function loadMap(name){
  if (name === curMap) return;
  curMap = name;
  if (window.bot){ scene.remove(bot.g); scene.remove(bot.laser); bot = null; }
  if (mapG){ scene.remove(mapG); mapG.traverse(o => { if(o.geometry) o.geometry.dispose(); }); mapG = null; }
  decals.splice(0).forEach(d => { scene.remove(d); d.geometry.dispose(); });
  const wh = (name === 'wh');
  whMeshes.forEach(o => o.visible = wh);
  whLights.forEach(l => l.visible = wh);
  blockers.length = 0; obs.length = 0;
  if (wh){
    blockers.push(...whBlk); obs.push(...whObs);
    fl.material = mFloor;
    [0,1,2,3].forEach(i => whBlk[i].visible = true);
    scene.background = new T.Color(0x07080a);
    scene.fog.color.set(0x07080a); scene.fog.density = .017;
    hemi.color.set(0x8a96a4); hemi.groundColor.set(0x15161a); hemi.intensity = .55;
    sun.color.set(0xcfd8e6); sun.intensity = .9; sun.position.set(18,40,12);
    rd.toneMappingExposure = 1.15;
  } else {
    blockers.push(whBlk[0],whBlk[1],whBlk[2],whBlk[3], fl);
    [0,1,2,3].forEach(i => whBlk[i].visible = false);
    fl.material = mSand;
    scene.background = skyT;
    scene.fog.color.set(0xd9c8a4); scene.fog.density = .006;
    hemi.color.set(0xbcd4f2); hemi.groundColor.set(0x9a8460); hemi.intensity = .95;
    sun.color.set(0xfff0d2); sun.intensity = 2.1; sun.position.set(35,55,25);
    rd.toneMappingExposure = 1;
    mapG = new T.Group(); scene.add(mapG); buildSand();
  }
  P.pos.set(MAPS[name].start[0], 0, MAPS[name].start[1]);
  P.vel.set(0,0,0); P.yaw = P.pitch = 0;
}