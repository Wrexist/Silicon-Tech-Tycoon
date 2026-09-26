/** Pinching is a camera gesture, never a build/hold gesture. Stay blocked until
 * the next fresh gesture, including the final finger-up of a pinch. */
export class FactoryGestureGuard {
  private pointers = new Set<number>();
  blocked = false;
  down(id: number) {
    if (this.pointers.size === 0) this.blocked = false;
    this.pointers.add(id);
    if (this.pointers.size > 1) this.blocked = true;
    return this.blocked;
  }
  up(id: number) { this.pointers.delete(id); }
  cancel() { this.pointers.clear(); this.blocked = true; }
}
