/* ═══════════════════════════════════════════════════════════════
   lab.js — shared engine for the options series
   Math, plotting, controls, and the teaching layer.
   Page files supply only their own figures, then call LAB.boot(drawAll).
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ═══════════ math ═══════════ */
const SQRT2PI=Math.sqrt(2*Math.PI);
const npdf=x=>Math.exp(-.5*x*x)/SQRT2PI;
function ncdf(x){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.2316419*a);
  const p=npdf(a)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return s>0?1-p:p;}
function bs(S,K,T,v,r,q,cp){
  T=Math.max(T,1e-9);v=Math.max(v,1e-9);S=Math.max(S,1e-9);
  const sq=Math.sqrt(T),sv=v*sq;
  const d1=(Math.log(S/K)+(r-q+.5*v*v)*T)/sv,d2=d1-sv;
  const eq=Math.exp(-q*T),er=Math.exp(-r*T);
  const N1=ncdf(d1),N2=ncdf(d2),n1=npdf(d1);
  const t1=S*eq*(cp?N1:N1-1),t2=K*er*(cp?N2:N2-1);
  const delta=cp?eq*N1:eq*(N1-1);
  const gamma=eq*n1/(S*sv), vega=S*eq*n1*sq;
  const dec=-(S*eq*n1*v)/(2*sq);
  const theta=cp?dec+q*S*eq*N1-r*K*er*N2:dec-q*S*eq*(1-N1)+r*K*er*(1-N2);
  const vanna=-eq*n1*d2/v, volga=vega*d1*d2/v;
  const cc=eq*n1*(2*(r-q)*T-d2*sv)/(2*T*sv);
  const charm=cp?q*eq*N1-cc:-q*eq*(1-N1)-cc;
  return{price:t1-t2,d1,d2,N1,N2,n1,t1,t2,delta,gamma,vega,theta,vanna,volga,charm,eq,er};
}
let zSpare=null;
function gauss(){
  if(zSpare!==null){const z=zSpare;zSpare=null;return z;}
  let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();
  const m=Math.sqrt(-2*Math.log(u));zSpare=m*Math.sin(2*Math.PI*v);return m*Math.cos(2*Math.PI*v);
}
/* Run fn with Math.random (and so gauss) replaced by a seeded generator, so a
   simulated figure opens on the same draw the prose describes. A "new run"
   button passes a different seed. */
function withSeed(seed,fn){const R=Math.random;let a=seed|0;zSpare=null;
  Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  try{return fn();}finally{Math.random=R;zSpare=null;}}
function gbm(S0,mu,sig,T,n){
  const dt=T/n,a=(mu-.5*sig*sig)*dt,b=sig*Math.sqrt(dt);
  const p=new Float64Array(n+1);let x=Math.log(S0);p[0]=S0;
  for(let i=1;i<=n;i++){x+=a+b*gauss();p[i]=Math.exp(x);}
  return p;
}

/* ═══════════ style tokens ═══════════ */
const CS=getComputedStyle(document.documentElement);
const C=n=>CS.getPropertyValue(n).trim();
const RM=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═══════════ responsive helpers ═══════════ */
const NARROW = () => window.innerWidth < 700;
/* canvas heights shrink on phones so a figure still fits above the fold */
function cvh(v){ return NARROW() ? Math.round(v*0.82) : v; }

/* ═══════════ figure helper ═══════════ */
function Fig(cv,opts){
  const h=cvh(opts.h), dpr=window.devicePixelRatio||1, w=cv.clientWidth||600;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+"px";
  const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  const P=Object.assign({l:46,r:10,t:10,b:24},opts.pad||{});
  /* phones narrow the margins, but never below what a figure's own labels need:
     a hard 44px cut dollar ticks like $1,800,000 and category names in half */
  if(NARROW()){ P.l=Math.min(P.l,Math.max(44,Math.round(w*0.3))); P.r=Math.min(P.r,28); P.b=Math.min(P.b,22); }
  const pw=w-P.l-P.r, ph=h-P.t-P.b;
  const o={g,w,h,P,pw,ph,cv,
    x0:opts.x0,x1:opts.x1,y0:opts.y0,y1:opts.y1,
    /* what was drawn, kept so the hover readout and marker dragging can use it */
    series:[],marks:[],labels:[],xf:null,yf:null,
    X(v){return P.l+(v-this.x0)/(this.x1-this.x0)*pw;},
    Y(v){return P.t+ph-(v-this.y0)/(this.y1-this.y0)*ph;}};
  g.font="10px "+"'IBM Plex Mono', monospace";
  cv.__fig=o; probeFor(cv);
  return o;
}
function nice(range,t){const raw=range/t,m=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/m;
  return (n<1.5?1:n<3?2:n<7?5:10)*m;}
function fnum(v){const a=Math.abs(v);
  if(a===0)return "0"; if(a<1e-4)return v.toExponential(1);
  if(a<.01)return v.toFixed(4); if(a<1)return v.toFixed(3);
  if(a<100)return v.toFixed(2); if(a<1e4)return v.toFixed(0);
  return (v/1000).toFixed(1)+"k";}
function axes(o,xf,yf,nx,ny){
  const {g,P,pw,ph}=o;
  o.xf=xf||null; o.yf=yf||null;
  g.strokeStyle=C("--hair"); g.lineWidth=1;
  g.fillStyle=C("--grey"); g.textBaseline="middle"; g.textAlign="right";
  const ys=nice(o.y1-o.y0,NARROW()?Math.max(2,(ny||4)-1):(ny||4));
  for(let v=Math.ceil(o.y0/ys)*ys;v<=o.y1;v+=ys){
    const y=Math.round(o.Y(v))+.5;
    g.globalAlpha=.55;g.beginPath();g.moveTo(P.l,y);g.lineTo(P.l+pw,y);g.stroke();g.globalAlpha=1;
    g.fillText(yf?yf(v):fnum(v),P.l-7,y);
  }
  if(o.y0<0&&o.y1>0){g.strokeStyle=C("--grey");g.globalAlpha=.5;
    const y=Math.round(o.Y(0))+.5;g.beginPath();g.moveTo(P.l,y);g.lineTo(P.l+pw,y);g.stroke();g.globalAlpha=1;}
  g.textAlign="center";g.textBaseline="top";g.fillStyle=C("--grey");
  let xs=nice(o.x1-o.x0,NARROW()?Math.max(2,(nx||5)-2):(nx||5));
  /* thin the ticks until the widest label fits between neighbours */
  for(let k=0;k<6;k++){let mw=0;
    for(let v=Math.ceil(o.x0/xs)*xs;v<=o.x1+xs*1e-9;v+=xs)mw=Math.max(mw,(g.measureText(xf?xf(v):fnum(v))||{}).width||0);
    if(!mw||Math.abs(o.X(o.x0+xs)-o.X(o.x0))>=mw+10)break; xs*=2;}
  /* a label centred on a tick at the plot's edge runs half off the canvas, so
     the outermost ones are pulled in to sit flush with the edge */
  for(let v=Math.ceil(o.x0/xs)*xs;v<=o.x1+xs*1e-9;v+=xs){
    const t=xf?xf(v):fnum(v),tw=(g.measureText(t)||{}).width||0,cx=o.X(v);
    if(cx+tw/2>o.w-1){g.textAlign="right";g.fillText(t,o.w-1,P.t+ph+7);}
    else if(cx-tw/2<1){g.textAlign="left";g.fillText(t,1,P.t+ph+7);}
    else{g.textAlign="center";g.fillText(t,cx,P.t+ph+7);}
  }
  g.textAlign="center";
  g.strokeStyle=C("--hair");g.beginPath();
  g.moveTo(P.l+.5,P.t);g.lineTo(P.l+.5,P.t+ph+.5);g.lineTo(P.l+pw,P.t+ph+.5);g.stroke();
}
function line(o,xs,ys,col,w,dash,alpha){
  /* A curve drawn exactly on top of an earlier solid one hides it, and the
     figures that do this are showing an identity, the one thing the reader
     must be able to see. So the later curve is dashed automatically, and both
     colours show. */
  if(o.series&&xs&&xs.length>1&&!dash){
    const yr=Math.abs(o.y1-o.y0)||1;
    for(const e of o.series){
      if(e.dash||e.col===col||e.xs.length!==xs.length)continue;
      let md=0,n=0;for(let i=0;i<xs.length;i++){const d=Math.abs(e.ys[i]-ys[i]);if(isFinite(d)){md=Math.max(md,d);n++;}}
      if(n>1&&md<.012*yr){dash=[7,5];w=Math.max(w||1.8,1.8);break;}
    }
  }
  if(o.series&&xs&&xs.length>1&&(alpha===undefined||alpha>.3))o.series.push({xs,ys,col,dash:!!dash});
  const g=o.g;g.save();g.strokeStyle=col;g.lineWidth=w||1.8;
  if(dash)g.setLineDash(dash); if(alpha!==undefined)g.globalAlpha=alpha;
  g.beginPath();let st=false;
  for(let i=0;i<xs.length;i++){const y=ys[i];
    if(!isFinite(y)){st=false;continue;}
    const px=o.X(xs[i]),py=o.Y(y);
    if(!st){g.moveTo(px,py);st=true;}else g.lineTo(px,py);}
  g.stroke();g.restore();
}
function vline(o,x,col,label,dash){
  if(x<o.x0||x>o.x1)return;const g=o.g;g.save();
  g.strokeStyle=col;g.lineWidth=1;g.setLineDash(dash||[3,3]);
  const px=Math.round(o.X(x))+.5;
  g.beginPath();g.moveTo(px,o.P.t);g.lineTo(px,o.P.t+o.ph);g.stroke();
  if(o.marks)o.marks.push({x,col,label:label||""});
  if(label){g.setLineDash([]);g.fillStyle=col;g.textAlign="left";g.textBaseline="top";
    g.font="9.5px 'IBM Plex Mono', monospace";
    /* place the label right of the line, or left of it near the edge, and step
       it down until it clears every label already placed on this figure */
    const tw=((g.measureText(label)||{}).width||label.length*6)+2;
    let lx=px+4; if(lx+tw>o.P.l+o.pw)lx=Math.max(o.P.l+2,px-4-tw);
    let ly=o.P.t+2;const L=o.labels||[];
    for(let k=0;k<8&&L.some(b=>lx<b.x+b.w&&lx+tw>b.x&&ly<b.y+11&&ly+11>b.y);k++)ly+=12;
    L.push({x:lx,y:ly,w:tw});
    g.fillText(label,lx,ly);}
  g.restore();
}

/* ═══════════ reading and dragging a figure ═══════════
   Every canvas drawn through Fig() gets, without any page code:
   · a hover readout — a hairline at the pointer and, for every curve drawn
     with line(), its value there, in the curve's own color;
   · draggable markers — a vline() drawn at exactly a slider's current value,
     in the same figure, can be dragged along the axis and moves that slider.
   Both read what the last draw recorded on the Fig, so they always match the
   picture. Heroes are left alone. */
function seriesAt(s,x){
  const xs=s.xs,ys=s.ys,n=xs.length;if(n<2)return NaN;
  const asc=xs[n-1]>xs[0];
  if((asc&&(x<xs[0]||x>xs[n-1]))||(!asc&&(x>xs[0]||x<xs[n-1])))return NaN;
  let lo=0,hi=n-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if((xs[m]<=x)===asc)lo=m;else hi=m;}
  const t=(x-xs[lo])/((xs[hi]-xs[lo])||1);
  return ys[lo]+(ys[hi]-ys[lo])*t;
}
function markBinding(cv,mark){
  const fig=cv.closest&&cv.closest("figure");if(!fig)return null;
  for(const key in SYNC){const e=SYNC[key];
    if(!e.host||!e.specs||!fig.contains(e.host))continue;
    for(const s of e.specs){const v=e.state[s.k];
      if(typeof v==="number"&&Math.abs(v-mark.x)<=1e-9*Math.max(1,Math.abs(v))&&v>=+s.min&&v<=+s.max)return{key,e,s};}}
  return null;
}
function probeFor(cv){
  if(cv.__probe||!cv.parentElement||!cv.addEventListener||!cv.closest)return;
  if(cv.id==="heroCv"||cv.closest(".hero"))return;
  cv.__probe=true;
  let ov=null,drag=null,raf=0;
  const overlay=()=>{
    if(!ov){ov=document.createElement("canvas");ov.className="probe";ov.setAttribute("aria-hidden","true");
      const p=cv.parentElement;if(getComputedStyle(p).position==="static")p.style.position="relative";
      cv.insertAdjacentElement("afterend",ov);}
    const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
    if(ov.width!==Math.round(W*dpr)||ov.height!==Math.round(H*dpr)){ov.width=Math.round(W*dpr);ov.height=Math.round(H*dpr);}
    Object.assign(ov.style,{position:"absolute",left:cv.offsetLeft+"px",top:cv.offsetTop+"px",width:W+"px",height:H+"px",pointerEvents:"none"});
    const g=ov.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);return g;
  };
  const clear=()=>{if(ov){const g=ov.getContext("2d");g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,ov.width,ov.height);}};
  const near=(o,px)=>{let best=null,bd=8;
    for(const m of o.marks){const d=Math.abs(o.X(m.x)-px);if(d<bd){const b=markBinding(cv,m);if(b){best={m,b};bd=d;}}}
    return best;};
  const fmtX=(o,v)=>{try{return o.xf?o.xf(v):fnum(v);}catch(e){return fnum(v);}};
  const fmtY=(o,v)=>{try{return o.yf?o.yf(v):fnum(v);}catch(e){return fnum(v);}};
  function draw(px,py){
    const o=cv.__fig;if(!o||!o.pw)return;
    const {P,pw,ph}=o;
    if(px<P.l||px>P.l+pw||py<P.t-4||py>P.t+ph+4){clear();cv.style.cursor="";return;}
    const g=overlay(),xv=o.x0+(px-P.l)/pw*(o.x1-o.x0);
    const hit=drag?null:near(o,px);
    cv.style.cursor=drag||hit?"ew-resize":"crosshair";
    g.strokeStyle=C("--ink");g.globalAlpha=.28;g.lineWidth=1;g.setLineDash([]);
    g.beginPath();g.moveTo(Math.round(px)+.5,P.t);g.lineTo(Math.round(px)+.5,P.t+ph);g.stroke();g.globalAlpha=1;
    const rows=[[fmtX(o,xv),C("--grey")]],seen=new Set();
    for(const s of o.series){const y=seriesAt(s,xv);
      if(!isFinite(y)||y<o.y0-(o.y1-o.y0)*.02||y>o.y1+(o.y1-o.y0)*.02)continue;
      const k=s.col+"|"+y.toPrecision(4);if(seen.has(k))continue;seen.add(k);
      g.fillStyle=s.col;g.beginPath();g.arc(px,o.Y(y),3.2,0,7);g.fill();
      if(rows.length<6)rows.push([fmtY(o,y),s.col]);}
    if(rows.length===1)rows.push([fmtY(o,o.y0+(P.t+ph-py)/ph*(o.y1-o.y0)),C("--grey")]);
    if(hit)rows.push(["drag to move",C("--grey")]);
    g.font="10.5px 'IBM Plex Mono', monospace";g.textBaseline="top";g.textAlign="left";
    const bw=Math.max(...rows.map(r=>g.measureText(r[0]).width))+14,bh=rows.length*14+8;
    let bx=px+12;if(bx+bw>o.w-2)bx=px-12-bw;let by=Math.max(P.t,Math.min(py-bh/2,P.t+ph-bh));
    g.fillStyle=C("--card")||"#F7F9F6";g.globalAlpha=.94;g.fillRect(bx,by,bw,bh);g.globalAlpha=1;
    g.strokeStyle=C("--hair");g.strokeRect(bx+.5,by+.5,bw-1,bh-1);
    rows.forEach((r,i)=>{g.fillStyle=r[1];g.fillText(r[0],bx+7,by+5+i*14);});
  }
  const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  let last=null;
  cv.addEventListener("pointermove",e=>{
    last=pos(e);
    if(drag){e.preventDefault();
      const o=cv.__fig,{b}=drag,s=b.s;
      let v=o.x0+(last[0]-o.P.l)/o.pw*(o.x1-o.x0);
      v=Math.min(+s.max,Math.max(+s.min,v));
      if(+s.step>0)v=+(+s.min+Math.round((v-s.min)/s.step)*s.step).toFixed(10);
      if(v!==b.e.state[s.k]){b.e.state[s.k]=v;
        if(!raf)raf=requestAnimationFrame(()=>{raf=0;b.e.sync();b.e.run(s.k);draw(...last);});}
      return;}
    draw(...last);
  });
  cv.addEventListener("pointerleave",()=>{if(!drag){clear();cv.style.cursor="";}});
  cv.addEventListener("pointerdown",e=>{
    const o=cv.__fig;if(!o)return;const [px]=pos(e),hit=near(o,px);
    if(!hit)return;
    drag=hit;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);e.preventDefault();
  });
  const end=()=>{if(drag){drag=null;if(last)draw(...last);}};
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  /* on touch, let vertical swipes scroll the page and horizontal ones drag */
  cv.style.touchAction="pan-y";
}
function clip(o,fn){const g=o.g;g.save();
  g.beginPath();g.rect(o.P.l,o.P.t,o.pw,o.ph);g.clip();fn();g.restore();}

/* ═══════════ slider factory ═══════════ */
const SYNC={};
function sliders(host,specs,state,onchange,key){
  host.innerHTML=specs.map(s=>`<div class="ctl">
    <div class="r"><span class="n"><b>${s.lbl}</b>${s.name}</span><span class="v" id="v_${s.id}"></span></div>
    <input type="range" id="i_${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" aria-label="${s.name}">
  </div>`).join("");
  const sync=()=>specs.forEach(s=>{
    document.getElementById("i_"+s.id).value=state[s.k];
    document.getElementById("v_"+s.id).textContent=s.fmt(state[s.k]);});
  specs.forEach(s=>{
    document.getElementById("i_"+s.id).addEventListener("input",e=>{
      state[s.k]=parseFloat(e.target.value);sync();onchange(s.k);});
  });
  sync();
  if(key)SYNC[key]={state,sync,run:()=>onchange(),specs,host};
  return sync;
}
/* preset(key, patch, focusId, animate) — with animate, slider values glide to
   their targets so the reader watches the figure change instead of seeing it
   jump. Only numeric slider values glide, snapped to each slider's step; a
   figure whose redraw is slow (a simulation) jumps straight to the end, and
   reduced motion always jumps. */
const TWEEN={};
function preset(key,patch,focusId,animate){
  const e=SYNC[key];if(!e)return;
  if(focusId){const el=document.getElementById(focusId);
    if(el)el.scrollIntoView({behavior:RM?"auto":"smooth",block:"center"});}
  if(TWEEN[key]){cancelAnimationFrame(TWEEN[key]);TWEEN[key]=0;}
  const specs=e.specs||[],from={},to={},rest={};
  for(const k in patch){const s=specs.find(s=>s.k===k);
    if(animate&&s&&typeof patch[k]==="number"&&typeof e.state[k]==="number"&&patch[k]!==e.state[k]){from[k]=e.state[k];to[k]=patch[k];}
    else rest[k]=patch[k];}
  Object.assign(e.state,rest);
  const ks=Object.keys(to);
  if(!ks.length||RM||typeof requestAnimationFrame!=="function"){Object.assign(e.state,to);e.sync();e.run();return;}
  const snap=(k,v)=>{const s=specs.find(s=>s.k===k),st=+s.step;return st>0?+(+s.min+Math.round((v-s.min)/st)*st).toFixed(10):v;};
  const t0=performance.now(),D=480,ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const step=()=>{
    const t=Math.min(1,(performance.now()-t0)/D),u=ease(t);
    ks.forEach(k=>e.state[k]=t>=1?to[k]:snap(k,from[k]+(to[k]-from[k])*u));
    const a=performance.now();e.sync();e.run();
    if(t<1&&performance.now()-a<18)TWEEN[key]=requestAnimationFrame(step);
    else{TWEEN[key]=0;if(t<1){Object.assign(e.state,to);e.sync();e.run();}}
  };
  step();
}
/* Focus an input only when the widget holding it is actually on screen, and
   never let focus move the page. A drill renders its first question during boot,
   and focusing an input fifteen thousand pixels down makes the browser scroll it
   into view — with smooth scrolling, that is a slow ride to the bottom of the
   page the moment it loads. Pass the container to test; the input itself works
   too when there is no wrapper. */
function focusSoft(el,within){
  if(!el)return;
  const b=(within||el).getBoundingClientRect();
  if(b.top<window.innerHeight&&b.bottom>0)el.focus({preventScroll:true});
}
const kvHTML=rows=>rows.map(([k,v])=>`<span class="k">${k}</span><span class="v">${v}</span>`).join("");
const pct=v=>(v*100).toFixed(1)+"%";
const pct2=v=>(v*100).toFixed(2)+"%";



/* term tooltips */
(function(){
  const tip=document.createElement("div");tip.id="tip";document.body.appendChild(tip);
  let open=null;
  function hide(){tip.style.display="none";open=null;}
  document.querySelectorAll(".term").forEach(el=>{
    el.setAttribute("tabindex","0");el.setAttribute("role","button");
    const show=()=>{
      tip.innerHTML='<span class="t">'+(el.dataset.t||"Definition")+'</span>'+el.dataset.def;
      tip.style.display="block";
      const r=el.getBoundingClientRect();
      const w=Math.min(330,window.innerWidth-24);
      tip.style.width=w+"px";
      let left=r.left+window.scrollX;
      if(left+w>window.innerWidth-12)left=window.innerWidth-w-12;
      tip.style.left=Math.max(12,left)+"px";
      tip.style.top=(r.bottom+window.scrollY+7)+"px";
      open=el;
    };
    el.addEventListener("click",e=>{e.stopPropagation();open===el?hide():show();});
    el.addEventListener("mouseenter",show);
    el.addEventListener("mouseleave",()=>{if(open===el)hide();});
    el.addEventListener("focus",show);
    el.addEventListener("blur",hide);
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();show();}});
  });
  document.addEventListener("click",hide);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")hide();});
  window.addEventListener("scroll",()=>{if(open)hide();},{passive:true});
})();


/* ══════════════════════════════════════════════
   teaching layer — presets, checks, score
   ══════════════════════════════════════════════ */
document.querySelectorAll("[data-preset],[data-click]").forEach(b=>{
  b.addEventListener("click",()=>{
    if(b.dataset.set&&window.setC0)window.setC0(JSON.parse(b.dataset.set));
    /* glide only when nothing else is clicked straight after, since a follow-up
       button (run a simulation) must see the final values */
    if(b.dataset.preset)preset(b.dataset.preset,JSON.parse(b.dataset.patch||"{}"),b.dataset.focus,!b.dataset.then&&!b.dataset.click);
    if(b.dataset.click){const t=document.getElementById(b.dataset.click);if(t)t.click();}
    if(b.dataset.then){const t=document.getElementById(b.dataset.then);if(t)t.click();}
  });
});

const QUIZ={answered:0,correct:0,total:document.querySelectorAll('.check[data-quiz] ').length};
document.querySelectorAll(".check").forEach(box=>{
  const isQuiz=box.hasAttribute("data-quiz");
  const opts=[...box.querySelectorAll(".opts button")];
  opts.forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(box.classList.contains("done"))return;
      const ok=btn.hasAttribute("data-ok");
      btn.classList.add(ok?"right":"wrong");
      if(!ok)opts.find(o=>o.hasAttribute("data-ok")).classList.add("right");
      opts.forEach(o=>o.disabled=true);
      box.classList.add("done");
      if(isQuiz){QUIZ.answered++;if(ok)QUIZ.correct++;score();}
    });
  });
});
function score(){
  const n=document.querySelectorAll(".check[data-quiz]").length;
  const num=document.getElementById("scoreNum"), t=document.getElementById("scoreTxt");
  if(!num||!t) return;               // page has checks but no scoreboard
  num.textContent=QUIZ.correct+" / "+n;
  if(QUIZ.answered<n){
    t.textContent=`${QUIZ.answered} of ${n} answered. Keep going.`;
  }else{
    const c=QUIZ.correct;
    t.textContent = c===n ? "Every one. You can read the derivations now and they'll land differently."
      : c>=6 ? "Solid. Reread the chapters behind the ones you missed — the explanations name them."
      : c>=4 ? "Half there. The misses are worth chasing; each explanation points at the chapter to revisit."
      : "Worth another pass. Work the try-this boxes rather than rereading — the figures teach faster than the prose.";
  }
}


/* ══════════════════════════════════════════════
   scroll chrome
   ══════════════════════════════════════════════ */
(function(){
  const bar=document.getElementById("prog");
  const links=[...document.querySelectorAll(".chapnav a")];
  const secs=links.map(a=>document.querySelector(a.getAttribute("href")));
  function upd(){
    const d=document.documentElement;
    bar.style.width=(d.scrollTop/(d.scrollHeight-d.clientHeight)*100)+"%";
    let cur=-1;
    secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<window.innerHeight*.42)cur=i;});
    links.forEach((a,i)=>a.classList.toggle("on",i===cur));
  }
  window.addEventListener("scroll",upd,{passive:true});upd();
})();


/* ═══════════ wide tables get a scroll container on small screens ═══════════ */
function wrapTables(){
  document.querySelectorAll("table.rot,table.wtab,table.blot,table.idtab,table.ntab")
    .forEach(t=>{
      if(t.parentElement && t.parentElement.classList.contains("tblwrap")) return;
      const w=document.createElement("div"); w.className="tblwrap";
      t.parentNode.insertBefore(w,t); w.appendChild(t);
    });
}

/* ═══════════ tutor launcher ═══════════
   A button on every page with chapters, and a small "ask" on each figure.
   assets/tutor.js (and the vendored SDK it imports) load only on the first
   click, so a reader who never opens it downloads nothing extra. Hidden on
   file:// (the dist/ copies), where module imports and pack fetches fail. */
window.LABAPI={SYNC,preset,bs};
function tutorLauncher(){
  if(typeof location==="undefined"||!/^https?:$/.test(location.protocol))return;
  if(!document.querySelector("section.chapter")||document.getElementById("tutorBtn"))return;
  let mod=null;
  const go=fig=>(mod||(mod=import(new URL("assets/tutor.js",document.baseURI).href)))
    .then(m=>m.open(fig)).catch(e=>{mod=null;console.error("tutor failed to load:",e);});
  const b=document.createElement("button");
  b.id="tutorBtn";b.type="button";b.className="tutorBtn";b.textContent="Ask the tutor";
  b.addEventListener("click",()=>go(null));document.body.appendChild(b);
  document.querySelectorAll("figure .figtop").forEach(t=>{
    const a=document.createElement("button");a.type="button";a.className="askFig";a.textContent="ask";
    a.setAttribute("aria-label","Ask the tutor about this figure");
    a.addEventListener("click",()=>go(t.closest("figure")));t.appendChild(a);
  });
}

/* ═══════════ boot ═══════════ */
const LAB = {
  boot(drawAll){
    wrapTables();
    try { tutorLauncher(); } catch(e){ console.error("tutor launcher:", e); }
    const safe = () => { try { drawAll(); } catch(e){ console.error("draw failed:", e); } };
    safe();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(safe);
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(safe, 150); });
    window.addEventListener("orientationchange", () => setTimeout(safe, 260));
    // re-wrap after any dynamic table render (the blotter rebuilds itself)
    const mo = new MutationObserver(() => wrapTables());
    mo.observe(document.body, {childList:true, subtree:true});
  }
};
