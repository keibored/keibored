// Rebuild with Node.js, sharp, and ffmpeg: node scripts/animate-banner.cjs
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const frames = path.join(root, 'frames');
fs.mkdirSync(frames, {recursive:true});
const W=1000, H=401, N=80;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t);};
const box=(x,y,l,t,r,b,f=14)=>smooth(l,l+f,x)*(1-smooth(r-f,r,x))*smooth(t,t+f,y)*(1-smooth(b-f,b,y));
async function main(){
 const src=await sharp(path.join(root,'assets/banner-source.png')).removeAlpha().raw().toBuffer();
 for(let frame=0;frame<N;frame++){
  const phase=2*Math.PI*frame/N, dst=Buffer.from(src);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   let dx=0,dy=0;
   // Fabric is pinned at the top; displacement grows toward the hem.
   const left=box(x,y,76,0,172,265,18);
   const right=box(x,y,387,0,463,191,13);
   dx+=left*4.5*Math.sin(phase+y/82)*Math.pow(y/265,0.7);
   dx+=right*3.4*Math.sin(phase+y/85+0.8)*(y/191);
   // Slow breath and a soft tail-tip sway, with feathered boundaries.
   const cat=box(x,y,136,235,272,309,18);
   dy+=cat*1.25*Math.sin(phase*2);
   const tail=box(x,y,111,226,146,294,9);
   dx+=tail*2.4*Math.sin(phase)*(1-(y-226)/68);
   if(dx===0 && dy===0)continue;
   const sx=Math.max(0,Math.min(W-1.001,x+dx)),sy=Math.max(0,Math.min(H-1.001,y+dy));
   const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
   for(let c=0;c<3;c++)dst[(y*W+x)*3+c]=Math.round(
    src[(iy*W+ix)*3+c]*(1-fx)*(1-fy)+src[(iy*W+ix+1)*3+c]*fx*(1-fy)+
    src[((iy+1)*W+ix)*3+c]*(1-fx)*fy+src[((iy+1)*W+ix+1)*3+c]*fx*fy);
  }
  // Render real typeset code so strings are valid and crisp at README size.
  let elements='<defs><linearGradient id="screen" x2="1" y2="1"><stop stop-color="#2a2038"/><stop offset="1" stop-color="#241c31"/></linearGradient></defs><rect x="465" y="84" width="346" height="157" fill="url(#screen)"/>';
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
  elements+='<rect x="877" y="274" width="79" height="35" fill="#30253f"/>';
  for(let j=0;j<7;j++){
   const h=9+23*(0.5+0.5*Math.sin(phase*2+j*0.8));
   elements+=`<rect x="${881+j*10}" y="${305-h}" width="5" height="${h}" fill="#c9a6df"/>`;
  }
  // Blinking editor caret; the complete code stays readable throughout.
  if(frame%16<9) elements+='<rect x="512" y="215" width="1.4" height="12" fill="#d5b9ed"/>';
  const overlay=Buffer.from(`<svg width="${W}" height="${H}">${elements}</svg>`);
  await sharp(dst,{raw:{width:W,height:H,channels:3}}).composite([{input:overlay}]).png().toFile(path.join(frames,String(frame).padStart(3,'0')+'.png'));
 }
 execFileSync('ffmpeg',['-v','error','-y','-framerate','10','-i',path.join(frames,'%03d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',path.join(root,'assets/kei-banner-code-a77f50e.gif')],{stdio:'inherit'});
 console.log('Created 80-frame, 8-second seamless looping banner.');
}
main().catch(e=>{console.error(e);process.exit(1)});
