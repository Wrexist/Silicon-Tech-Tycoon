// Uploads the reviewed Header and Search Results art (appstore/creative-assets) into the app's Asset
// Library and places it on the editable 1.4.0 draft's en-US page, replacing that draft's previous
// header / search placements. The live version is never touched, nothing is submitted, and replaced
// images stay in the Asset Library (only their placement on this draft is removed).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { asc, sanitized } from './app-store-client.mjs';

const appId = '6778942533', versionString = process.env.STORE_VERSION || '1.4.0', locale = 'en-US';
const ART = [
  ['appstore/creative-assets/header-3840x1646.png', 'PRODUCT_PAGE_HEADER_ASSET', 'Silicon 1.4.0 header'],
  ['appstore/creative-assets/search-3840x2560.png', 'APP_STORE_SEARCH_RESULTS_ASSET', 'Silicon 1.4.0 search'],
];
const out = 'artifacts/creative-assets';
mkdirSync(out, { recursive: true });
const save = (name, data) => writeFileSync(join(out, name + '.json'), JSON.stringify(sanitized(data), null, 2));
const wait = ms => new Promise(r => setTimeout(r, ms));

const versions = await asc(`/v1/apps/${appId}/appStoreVersions?limit=50`);
const version = versions.data.find(v => v.attributes.versionString === versionString && v.attributes.platform === 'IOS');
if (!version || version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') throw Error(`Expected editable iOS ${versionString} draft`);
const loc = (await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`)).data.find(l => l.attributes.locale === locale);
if (!loc) throw Error('Expected an en-US localization');
const library = (await asc(`/v1/apps/${appId}/assetLibrary`)).data;
const types = ART.map(a => a[1]).join(',');
save('ref-data', await asc(`/v1/appAssetLibraryRefData?filter[placementTypes]=${types}`).catch(e => ({ error: String(e) })));
const before = await asc(`/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=200&include=image`);
save('placements-before', before);
console.log('Existing draft placements:', before.data.map(p => `${p.attributes.placementType}:${p.attributes.state}`).join(', ') || 'none');

for (const [file, placementType, referenceName] of ART) {
  const bytes = readFileSync(file);
  const old = before.data.filter(p => p.attributes.placementType === placementType);
  // A new version inherits the previous version's placements: if this art is already the one placed
  // here, there is nothing to do (re-uploading would also collide on the library reference name).
  const images = Object.fromEntries((before.included ?? []).map(i => [i.id, i.attributes ?? {}]));
  if (old.some(p => { const img = images[p.relationships?.image?.data?.id]; return img && img.referenceName === referenceName && img.fileName === basename(file); })) {
    console.log('Already placed', placementType, basename(file)); continue;
  }
  const image = (await asc('/v1/appAssetLibraryImages', 'POST', {
    type: 'appAssetLibraryImages',
    attributes: { category: 'CREATIVE_ASSETS', fileName: basename(file), fileSize: bytes.length, referenceName },
    relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: library.id } } },
  })).data;
  save(`image-${image.id}`, image);
  for (const op of image.attributes.uploadOperations) {
    const response = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])), body: bytes.subarray(op.offset, op.offset + op.length), signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error(`Image part upload failed: ${response.status}`);
  }
  await asc(`/v1/appAssetLibraryImages/${image.id}`, 'PATCH', { type: 'appAssetLibraryImages', id: image.id, attributes: { uploaded: true } });
  let state;
  for (let i = 0; i < 100; i++) {
    const now = (await asc(`/v1/appAssetLibraryImages/${image.id}`)).data.attributes;
    state = now.state;
    if (state === 'FAILED' || state === 'REJECTED') throw Error(`${basename(file)} ${state}: ${JSON.stringify(now.stateDetails)}`);
    if (!['AWAITING_UPLOAD', 'UPLOAD_COMPLETE'].includes(state)) break;
    await wait(6000);
  }
  console.log('Image', basename(file), state);
  const place = () => asc('/v1/appAssetLibraryPlacements', 'POST', {
    type: 'appAssetLibraryPlacements',
    attributes: { placementType },
    relationships: { image: { data: { type: 'appAssetLibraryImages', id: image.id } }, appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
  });
  let placement;
  try { placement = (await place()).data; }
  catch (e) {
    // A slot that only holds one asset refuses a second: free it, then place again.
    if (!/: 409 /.test(String(e)) || !old.length) throw e;
    for (const p of old.splice(0)) { await asc(`/v1/appAssetLibraryPlacements/${p.id}`, 'DELETE'); console.log('Freed', placementType, 'slot', p.id); }
    placement = (await place()).data;
  }
  for (let i = 0; i < 100; i++) {
    const now = (await asc(`/v1/appAssetLibraryPlacements/${placement.id}`)).data.attributes;
    if (now.state === 'FAILED') throw Error(`${placementType} placement failed: ${JSON.stringify(now.stateDetails)}`);
    if (now.state !== 'ASSET_PROCESSING') { console.log('Placed', placementType, now.state); break; }
    await wait(6000);
  }
  // Only now that the new art is placed, retire this draft's previous placement of the same type.
  for (const p of old) { await asc(`/v1/appAssetLibraryPlacements/${p.id}`, 'DELETE'); console.log('Removed previous', placementType, 'placement', p.id); }
}
save('placements-after', await asc(`/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=200&include=image`));
