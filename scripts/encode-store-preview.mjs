import { mkdirSync, existsSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve(process.env.STORE_MEDIA_DIR || 'appstore/release-1.4.0'), out=join(root,'preview'); mkdirSync(out,{recursive:true});
const ffmpeg=process.env.SHOTS_FFMPEG || 'ffmpeg';
const font=process.platform==='win32' ? 'C\\:/Windows/Fonts/segoeuib.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const scenes=[['office','Build your dream studio.'],['design','Design your next breakthrough.'],['factory','Build it. Watch it move.'],['research','Research a new era.'],['company','Grow your tech empire.']];
function run(args) { const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'}); if(r.status!==0) throw Error(`ffmpeg failed (${r.status}): ${r.error||args.join(' ')}`); }
// Apple's screenshot delivery expects RGB, even when an RGBA image is fully opaque.
for(const device of ['iphone','ipad']) for(const name of readdirSync(join(root,device)).filter(n=>/^\d\d-.*\.png$/.test(n))) {
  const path=join(root,device,name), rgb=path+'.rgb.png';
  run(['-i',path,'-frames:v','1','-pix_fmt','rgb24',rgb]);
  renameSync(rgb,path);
}
for(const [id,label] of scenes) {
  const frames=join(root,'preview-frames',id);
  if(!existsSync(join(frames,'0119.png')))throw Error(`Incomplete real-gameplay frames: ${id}`);
  run(['-framerate','30','-i',join(frames,'%04d.png'),'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf',`scale=830:1800:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=886:1920:(ow-iw)/2:120:color=0x0b1320,drawtext=fontfile='${font}':text='${label}':fontcolor=white:fontsize=42:x=32:y=36`,
    '-frames:v','120','-r','30','-c:v','libx264','-profile:v','high','-level:v','4.0','-pix_fmt','yuv420p','-preset','medium','-b:v','10M','-minrate','10M','-maxrate','10M','-bufsize','20M','-x264-params','nal-hrd=cbr:force-cfr=1',
    '-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-shortest','-movflags','+faststart',join(out,`${id}.mp4`)]);
}
const list=join(out,'concat.txt');writeFileSync(list,scenes.map(([id])=>`file '${id}.mp4'`).join('\n'));
const target=join(out,'Silicon-1.4.0-iPhone.mp4');
run(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',target]);
run(['-ss','5','-i',target,'-frames:v','1',join(out,'poster.png')]);
console.log('PREVIEW',target,'20 seconds, 886x1920, 30fps, H.264 High 4.0, stereo AAC');
