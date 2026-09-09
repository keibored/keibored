// Rebuild with Node.js, sharp, and ffmpeg: node scripts/animate-banner.cjs
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const frames = path.join(root, 'frames');
fs.mkdirSync(frames, {recursive:true});
const W=1000, H=401, N=160;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t);};
const box=(x,y,l,t,r,b,f=14)=>smooth(l,l+f,x)*(1-smooth(r-f,r,x))*smooth(t,t+f,y)*(1-smooth(b-f,b,y));
// Fabric-only polygons, inset from silhouettes, plants, and architecture.
// Deliberately keep the sheer curtain's visible window crossbar fixed too.
const clothPolygons=[
 [[105,2],[136,2],[135,49],[128,57],[107,52]],
 [[103,90],[128,90],[120,125],[109,151],[97,168],[86,202],[84,224],[98,233],[106,204],[114,166],[120,135]],
 [[396,2],[450,2],[450,163],[441,166],[433,146],[424,117],[416,88],[410,57]]
];
function clothWeight(x,y,poly){
 let inside=false, distance=Infinity;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [ax,ay]=poly[j],[bx,by]=poly[i];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  const vx=bx-ax,vy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy)));
  distance=Math.min(distance,Math.hypot(x-ax-t*vx,y-ay-t*vy));
 }
 return inside?smooth(2,9,distance):0;
}
async function main(){
 const src=await sharp(path.join(root,'assets/banner-source-v3.png')).removeAlpha().raw().toBuffer();
 const cloth=new Float32Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)cloth[y*W+x]=Math.max(...clothPolygons.map(p=>clothWeight(x,y,p)));
 for(let frame=0;frame<N;frame++){
  const phase=2*Math.PI*frame/N, dst=Buffer.from(src);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   let dx=0,dy=0;
   // Visible fold ripples only inside opaque fabric; never move a whole rectangle.
   dx+=cloth[y*W+x]*6.0*Math.sin(phase+y/76+(x>300?0.8:0))*smooth(0,110,y);
   // Slow breath and a soft tail-tip sway, with feathered boundaries.
   const cat=box(x,y,136,235,272,309,18);
   dy+=cat*3.5*Math.sin(phase*2);
   const tail=box(x,y,111,226,146,294,9);
   dx+=tail*12.0*Math.sin(phase)*(1-(y-226)/68);
   // A brief paired ear twitch once per loop.
   const ear=box(x,y,207,238,244,276,7);
   const twitch=Math.pow(Math.max(0,Math.cos(phase-1.7)),18)*Math.sin(phase*12);
   dx+=ear*3.5*twitch;
   dy-=ear*2.0*twitch;
   if(dx===0 && dy===0)continue;
   const sx=Math.max(0,Math.min(W-1.001,x+dx)),sy=Math.max(0,Math.min(H-1.001,y+dy));
   const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
   for(let c=0;c<3;c++)dst[(y*W+x)*3+c]=Math.round(
    src[(iy*W+ix)*3+c]*(1-fx)*(1-fy)+src[(iy*W+ix+1)*3+c]*fx*(1-fy)+
    src[((iy+1)*W+ix)*3+c]*(1-fx)*fy+src[((iy+1)*W+ix+1)*3+c]*fx*fy);
  }
  // Render real typeset code so strings are valid and crisp at README size.
  let elements='<defs><linearGradient id="screen" x2="1" y2="1"><stop stop-color="#2a2038"/><stop offset="1" stop-color="#241c31"/></linearGradient></defs><rect x="465" y="84" width="346" height="154" fill="url(#screen)"/>';
  const lines=[
   '<tspan fill="#dc87e3">const</tspan> developer = {',
   '  name: <tspan fill="#a0e3ce">"kei"</tspan>,',
   '  role:',
   '    <tspan fill="#a0e3ce">"aspiring software engineer"</tspan>,',
   '  status: <tspan fill="#a0e3ce">"open to work"</tspan>',
   '};'
  ];
  lines.forEach((line,i)=>{
   elements+=`<text x="484" y="${105+i*20}" font-family="DejaVu Sans Mono,monospace" font-size="11" fill="#87749f">${i+1}</text><text xml:space="preserve" x="512" y="${105+i*20}" font-family="DejaVu Sans Mono,monospace" font-size="12.5" fill="#f1deed">${line}</text>`;
  });
  // Keep the illustration's tiny music player animated.
  elements+='<rect x="877" y="254" width="79" height="48" fill="#30253f"/>';
  for(let j=0;j<7;j++){
   const h=9+23*(0.5+0.5*Math.sin(phase*2+j*0.8));
   elements+=`<rect x="${881+j*10}" y="${299-h}" width="5" height="${h}" fill="#c9a6df"/>`;
  }
  // Twinkles brighten existing points of light without moving the sky.
  const stars=[[184,42],[263,33],[315,29],[370,66],[291,85],[347,47]];
  stars.forEach(([x,y],i)=>{
   const glow=Math.pow(0.5+0.5*Math.sin(phase*2+i*1.3),4);
   elements+=`<g opacity="${0.8*glow}"><circle cx="${x}" cy="${y}" r="3" fill="#eed8ff" opacity=".2"/><path d="M${x-3.5},${y}h7 M${x},${y-3.5}v7" stroke="#fff0e8" stroke-width=".8"/><circle cx="${x}" cy="${y}" r=".9" fill="#fff9e8"/></g>`;
  });
  // Blinking editor caret; the complete code stays readable throughout.
  if(frame%32<18) elements+='<rect x="512" y="215" width="1.4" height="12" fill="#d5b9ed"/>';
  const overlay=Buffer.from(`<svg width="${W}" height="${H}">${elements}</svg>`);
  await sharp(dst,{raw:{width:W,height:H,channels:3}}).composite([{input:overlay}]).png().toFile(path.join(frames,String(frame).padStart(3,'0')+'.png'));
 }
 execFileSync('ffmpeg',['-v','error','-y','-framerate','20','-i',path.join(frames,'%03d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',path.join(root,'assets/kei-banner-motion-v4.gif')],{stdio:'inherit'});
 console.log('Created 160-frame, 8-second seamless looping banner.');
}
main().catch(e=>{console.error(e);process.exit(1)});
