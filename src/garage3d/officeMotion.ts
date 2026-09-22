// Presentation-only locomotion; keep translation on the validated route segment.
export interface MotionState { x: number; z: number; face: number; speed: number }
export const WALK_SPEED = 0.62;
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to-from), Math.cos(to-from));
}
export function stepOfficeMotion(state: MotionState, target: {x:number;z:number}, seconds:number) {
  const dt=Math.max(0,Math.min(seconds,0.05));
  const dx=target.x-state.x,dz=target.z-state.z,distance=Math.hypot(dx,dz);
  if(distance<1e-8 || dt===0)return {...state,speed:distance<1e-8?0:state.speed,distance:0};
  const yaw=Math.atan2(dx,dz),turn=angleDelta(state.face,yaw);
  const face=state.face+Math.sign(turn)*Math.min(Math.abs(turn),3.6*dt);
  const alignment=Math.max(0,Math.cos(angleDelta(face,yaw)));
  const desired=Math.min(WALK_SPEED,Math.sqrt(2*1.4*distance))*alignment;
  const speed=state.speed+Math.max(-2.4*dt,Math.min(1.4*dt,desired-state.speed));
  // Turn in place before reversing; never slide backwards through a corner.
  const advance=Math.min(distance,speed*dt*alignment);
  return {x:state.x+dx/distance*advance,z:state.z+dz/distance*advance,face,speed,distance:advance};
}
export interface WalkPose { phase: number; weight: number }
export function updateWalkPose(pose: WalkPose, distance: number, seconds: number): void {
  const dt=Math.max(0,Math.min(seconds,0.05));
  pose.phase=(pose.phase+Math.max(0,distance)*9.7)%(Math.PI*2);
  const target=dt>0?Math.min(1,Math.max(0,distance)/(WALK_SPEED*dt)):0;
  pose.weight+=(target-pose.weight)*(1-Math.exp(-12*dt));
}
