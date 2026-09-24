import { it, expect } from 'vitest';
import * as THREE from 'three';
import { factoryFrame } from './factoryFraming.ts';

it('keeps the workshop and dock visible at small phone, landscape and expanded-floor sizes', () => {
  for (const aspect of [.45,.75,1,1.6,2.4]) for (const cx of [0,2,4,8]) {
    const f=factoryFrame(aspect,cx),camera=new THREE.PerspectiveCamera(f.fov,aspect,.1,500);
    camera.position.copy(f.position);camera.lookAt(f.target);camera.updateMatrixWorld();
    for (const corner of f.corners) { const p=corner.clone().project(camera);expect(Math.abs(p.x)).toBeLessThanOrEqual(1);expect(Math.abs(p.y)).toBeLessThanOrEqual(1);expect(p.z).toBeLessThan(1); }
  }
});
