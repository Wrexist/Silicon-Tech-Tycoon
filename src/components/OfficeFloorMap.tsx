import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { footprint, furnitureDef, gridN, type PlacedItem } from "../engine/furniture.ts";

/** Saved furniture, rendered without WebGL. All edits use the existing office reducers. */
export function OfficeFloorMap({ layout, facilityTier, companyName, build, selectedIid, onSelect, onMove }: {
  layout: PlacedItem[]; facilityTier: number; companyName: string; build: boolean;
  selectedIid: string | null; onSelect: (iid: string | null) => void;
  onMove: (iid: string, c: number, r: number) => void;
}) {
  const n = gridN(facilityTier);
  const selected = layout.find(x => x.iid === selectedIid);
  const [column, setColumn] = useState(0), [row, setRow] = useState(0);
  useEffect(() => { if (selected) { setColumn(selected.c); setRow(selected.r); } }, [selected]);
  return <div className={`office-map${build ? " office-map--build" : ""}`}>
    <p className="office-map__title">{companyName} ? Office layout</p>
    <svg className="office-map__floor" viewBox={`0 0 ${n * 40} ${n * 40}`} role="img" aria-label={`Office floor with ${layout.length} owned pieces. Top view; row 1 is the back wall.`}>
      <rect width={n * 40} height={n * 40} className="office-map__ground" />
      {Array.from({ length: n + 1 }, (_, i) => <path key={i} d={`M${i * 40} 0V${n * 40}M0 ${i * 40}H${n * 40}`} className="office-map__line" />)}
      {layout.map((item, index) => {
        const def = furnitureDef(item.type), size = footprint(def, item.rot);
        return <g key={item.iid} data-office-item={item.iid} onClick={build ? () => onSelect(item.iid) : undefined}>
          <title>{`${index + 1}. ${def.name}, column ${item.c + 1}, row ${item.r + 1}, rotation ${item.rot * 90} degrees`}</title>
          <rect x={item.c * 40 + 2} y={item.r * 40 + 2} width={size.w * 40 - 4} height={size.d * 40 - 4} className={item.iid === selectedIid ? "office-map__piece office-map__piece--selected" : "office-map__piece"} />
          <text x={(item.c + size.w / 2) * 40} y={(item.r + size.d / 2) * 40 + 4} textAnchor="middle">{index + 1}</text>
          <g transform={`translate(${(item.c + size.w) * 40 - 14},${item.r * 40 + 4}) rotate(${item.rot * 90} 5 5)`}><ArrowUp width={10} height={10} /></g>
        </g>;
      })}
    </svg>
    {build ? <>
      <label>Furniture<select aria-label="Select office furniture" value={selectedIid ?? ""} onChange={e => onSelect(e.target.value || null)}>
        <option value="">Choose an owned item</option>
        {layout.map((item, i) => <option key={item.iid} value={item.iid}>{i + 1}. {furnitureDef(item.type).name}</option>)}
      </select></label>
      {selected && <div className="office-map__move">
        <label>Column<select aria-label="Move to column" value={column} onChange={e => setColumn(Number(e.target.value))}>{Array.from({ length: n }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
        <label>Row<select aria-label="Move to row" value={row} onChange={e => setRow(Number(e.target.value))}>{Array.from({ length: n }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
        <button className="hqb__tool" onClick={() => onMove(selected.iid, column, row)}>Move</button>
      </div>}
      <p>Choose an item, then set its destination.</p>
    </> : <p>Top view of your owned furniture. Open Shop to select and arrange items.</p>}
  </div>;
}
