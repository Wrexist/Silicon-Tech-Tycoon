import {expect,it} from 'vitest';
import {angleDelta,stepOfficeMotion,updateWalkPose,WALK_SPEED} from './officeMotion.ts';
it('accelerates gently and lands exactly without overshoot at different frame rates',()=>{
 for(const fps of [20,30,60,120]){
  let s={x:0,z:0,face:0,speed:0};const target={x:0,z:2};
  expect(stepOfficeMotion(s,target,1/fps).speed).toBeLessThan(WALK_SPEED);
  for(let i=0;i<fps*8;i++){s=stepOfficeMotion(s,target,1/fps);expect(s.z).toBeLessThanOrEqual(2);expect(s.x).toBe(0);}
  expect(s.z).toBeCloseTo(2,6);
 }
});
it('turns before reversing and takes the shortest angle across the wrap',()=>{
 const next=stepOfficeMotion({x:0,z:0,face:0,speed:0},{x:0,z:-2},0.05);
 expect(next.distance).toBe(0);expect(Math.abs(next.face)).toBeCloseTo(0.18);
 expect(angleDelta(Math.PI-0.01,-Math.PI+0.01)).toBeCloseTo(0.02);
});
it('gait follows distance and settles to neutral when blocked',()=>{
 const a={phase:0,weight:0},b={phase:0,weight:0};
 for(let i=0;i<20;i++)updateWalkPose(a,0.01,0.05);
 for(let i=0;i<40;i++)updateWalkPose(b,0.005,0.025);
 expect(a.phase).toBeCloseTo(b.phase,10);const phase=a.phase;
 for(let i=0;i<40;i++)updateWalkPose(a,0,0.025);
 expect(a.phase).toBe(phase);expect(a.weight).toBeLessThan(0.0001);
});
it('does not turn a resume gap into a teleport',()=>{
 const s={x:0,z:0,face:0,speed:WALK_SPEED};
 expect(stepOfficeMotion(s,{x:0,z:3},10).distance).toBeLessThanOrEqual(WALK_SPEED*0.05);
});
