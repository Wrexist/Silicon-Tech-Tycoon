// Baked contact shadows that re-bake WITHOUT leaking GPU memory.
//
// drei's <ContactShadows> allocates two render targets (and four materials) when it mounts and never
// disposes them. Both worlds used to force a re-bake by changing its `key` on every layout edit, which
// remounted it — about 2 MB of GPU memory left behind per edit, enough over a long build or decorate
// session to push an older iPhone's WebGL context over the edge.
//
// It doesn't need a remount: with `frames={1}` drei re-bakes on any RE-RENDER (its frame counter lives
// in the render body), and a re-render with the same resolution / scale / color keeps its targets. So
// this wrapper renders exactly when `bake` (the layout fingerprint) or a visual prop changes, and
// otherwise not at all — one bake per edit, one set of targets for the life of the scene.
import { memo, type ComponentProps } from "react";
import { ContactShadows } from "@react-three/drei";

type Props = Omit<ComponentProps<typeof ContactShadows>, "frames" | "key"> & {
  /** Any string that changes when the scene's static layout does; a change triggers one re-bake. */
  bake: string;
};

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b;

function equal(a: Props, b: Props): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Props>;
  for (const k of keys) if (!same(a[k], b[k])) return false;
  return true;
}

export const BakedContactShadows = memo(function BakedContactShadows({ bake: _bake, ...props }: Props) {
  return <ContactShadows {...props} frames={1} />;
}, equal);
