// Parametric circuit-board motif: a premium, immersive backdrop graphic drawn entirely in vector
// (zero image assets, per LEARNINGS). The geometry is fixed (deterministic, no rng) and reads as a
// silicon die / board layout. Colour + opacity are owned by the consumer via CSS targeting the inner
// `.circuitm__traces` / `.circuitm__nodes` groups under the passed className.
const TRACES = [
  "M0 38 H78 L96 56 H190",
  "M340 64 H252 L232 84 H156",
  "M16 208 H118 L138 188 H214 L234 208 H340",
  "M0 132 H54 L74 152 V210",
  "M340 150 H276 L258 132 H198",
  "M120 0 V44 L138 62 V104",
];
const NODES: [number, number][] = [
  [190, 56], [156, 84], [54, 132], [276, 150], [138, 62], [214, 188], [96, 56], [232, 84],
];

export function CircuitMotif({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 240" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <g className="circuitm__traces">
        {TRACES.map((d) => <path key={d} d={d} />)}
      </g>
      <g className="circuitm__nodes">
        {NODES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} />)}
      </g>
    </svg>
  );
}
