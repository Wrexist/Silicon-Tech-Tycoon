import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve(process.env.STORE_MEDIA_DIR || 'appstore/release-1.4.0'), out=join(root,'preview'); mkdirSync(out,{recursive:true});
const ffmpeg=process.env.SHOTS_FFMPEG || 'ffmpeg';
const font=process.platform==='win32' ? 'C\\:/Windows/Fonts/segoeuib.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const scenes=[['office','Build your dream studio.'],['design','Design your next breakthrough.'],['factory','Build it. Watch it move.'],['research','Research a new era.'],['company','Grow your tech empire.']];
function run(args) { const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'}); if(r.status!==0) throw Error(`ffmpeg failed (${r.status}): ${r.error||args.join(' ')}`); }
for(const [id,label] of scenes) {
  const frames=join(root,'preview-frames',id);
  if(!existsSync(join(frames,'0119.png')))throw Error(`Incomplete real-gameplay frames: ${id}`);
  run(['-framerate','30','-i',join(frames,'%04d.png'),'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf',`scale=886:1920:flags=lanczos,drawbox=x=0:y=0:w=iw:h=116:color=0x0b1320@0.94:t=fill,drawtext=fontfile='${font}':text='${label}':fontcolor=white:fontsize=42:x=32:y=36`,
    '-frames:v','120','-r','30','-c:v','libx264','-profile:v','high','-level:v','4.0','-pix_fmt','yuv420p','-preset','medium','-b:v','10M','-maxrate','12M','-bufsize','20M',
    '-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-shortest','-movflags','+faststart',join(out,`${id}.mp4`)]);
}
const list=join(out,'concat.txt');writeFileSync(list,scenes.map(([id])=>`file '${id}.mp4'`).join('\n'));
const target=join(out,'Silicon-1.4.0-iPhone.mp4');
run(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',target]);
run(['-ss','5','-i',target,'-frames:v','1',join(out,'poster.png')]);
console.log('PREVIEW',target,'20 seconds, 886x1920, 30fps, H.264 High 4.0, stereo AAC');
