// Shared catalog finishes. Intrinsic furniture colour stays stable across room themes.
import { CATALOG, type RoomPalette } from './palette.ts';
export function catalogFinish(materialName: string, assetUrl: string): string | undefined {
 const name=materialName.replace(/#[0-9a-fA-F]{3,8}$/, '').trim();
 if(name==='wood' && /plant(Pot|Tall)\.glb$/.test(assetUrl))return CATALOG.warmGrey;
 return ({wood:CATALOG.woodMid,woodDark:CATALOG.woodDark,carpet:CATALOG.fabric,
  carpetBlue:CATALOG.fabric2,carpetDarker:CATALOG.graphite,metal:CATALOG.aluminium,
  metalMedium:CATALOG.graphite,plant:CATALOG.plantDeep,_defaultMat:CATALOG.paper} as Record<string,string>)[name];
}
export function furniturePalette(p: RoomPalette): RoomPalette {
 return {...p,desk:CATALOG.woodMid,deskDark:CATALOG.woodDark,metal:CATALOG.aluminium,
  metalDark:CATALOG.graphite,pot:CATALOG.warmGrey,plant:CATALOG.plantDeep};
}
