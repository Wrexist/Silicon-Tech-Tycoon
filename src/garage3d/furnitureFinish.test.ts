import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {catalogFinish,furniturePalette} from './furnitureFinish.ts';
import {CATALOG,roomPalette} from './palette.ts';
import {robotSeatLift,publishSeatSurface,sofaSeatSurface,ROBOT_SEATED_UNDERSIDE} from './seatAnchors.ts';
import {MODEL_ASSETS} from './furnitureModels.ts';
describe('catalog finish integration',()=>{
 it('maps every shipped non-luminous material without changing source files',()=>{
  for(const file of readdirSync('public/furniture').filter(f=>f.endsWith('.glb'))){
   const b=readFileSync('public/furniture/'+file),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
   for(const m of json.materials??[])if(m.name!=='lamp')expect(catalogFinish(m.name,'furniture/'+file),file+':'+m.name).toBeDefined();
  }
 });
 it('shares fabric/wood between imported seating and procedural fallback, keeping planter pots distinct',()=>{
  expect(catalogFinish('carpet','furniture/sofa.glb')).toBe(CATALOG.fabric);
  expect(catalogFinish('wood','furniture/coffeeTable.glb')).toBe(CATALOG.woodMid);
  expect(catalogFinish('wood','furniture/plantPot.glb')).toBe(CATALOG.warmGrey);
  expect(catalogFinish('woodDark','furniture/crates.glb')).not.toBe(catalogFinish('wood','furniture/crates.glb'));
  expect(catalogFinish('lamp','furniture/floorLamp.glb')).toBeUndefined();
 });
 it('matches intrinsic finishes across themes without changing room finishes',()=>{
  for(const dark of [false,true]){const p=roomPalette(dark),f=furniturePalette(p);expect(f.floor).toBe(p.floor);expect(f.wallA).toBe(p.wallA);expect(f.desk).toBe(CATALOG.woodMid);expect(f.plant).toBe(CATALOG.plantDeep);expect(f.pot).toBe(CATALOG.warmGrey);}
 });
 it('seats the robot underside on the fitted cushion, including the procedural fallback',()=>{
  expect(robotSeatLift(0.48)+ROBOT_SEATED_UNDERSIDE).toBeCloseTo(0.48);
  const b=readFileSync('public/furniture/sofa.glb'),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  const bounds=j.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>j.accessors[p.attributes.POSITION]));
  const height=Math.max(...bounds.map((b:any)=>b.max[1])),width=Math.max(...bounds.map((b:any)=>b.max[0]));
  const scale=Math.min(1.72*0.92/width,MODEL_ASSETS.sofa!.realHeight!/height);
  const surface=height*scale*MODEL_ASSETS.sofa!.seatSurfaceFraction!;
  publishSeatSurface('furniture/sofa.glb',surface);
  expect(surface).toBeCloseTo(0.37138,3);
  expect(robotSeatLift(sofaSeatSurface())+ROBOT_SEATED_UNDERSIDE).toBeCloseTo(surface,8);
 });
});
