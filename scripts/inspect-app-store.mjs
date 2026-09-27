// Read-only App Store Connect inspection. Keys remain only in the existing CI secret environment.
import { sign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const keyId=process.env.APP_STORE_CONNECT_KEY_ID, issuer=process.env.APP_STORE_CONNECT_ISSUER_ID;
const encoded=process.env.APP_STORE_CONNECT_API_KEY_BASE64;
if(!keyId || !issuer || !encoded) throw Error('Missing App Store Connect credentials');
const key=encoded.includes('BEGIN PRIVATE KEY')?encoded:Buffer.from(encoded.replace(/\s/g,''),'base64').toString('utf8');
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const payload=`${b64({alg:'ES256',kid:keyId,typ:'JWT'})}.${b64({iss:issuer,iat:now,exp:now+600,aud:'appstoreconnect-v1'})}`;
const token=payload+'.'+sign('sha256',Buffer.from(payload),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function get(path) {
  const response=await fetch('https://api.appstoreconnect.apple.com'+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
  const body=await response.json();
  if(!response.ok)throw Error(`ASC ${response.status}: ${body.errors?.map(e=>e.detail||e.title).join('; ')||path}`);
  return body;
}
const apps=await get('/v1/apps?filter[bundleId]=com.wrexist.silicon');
if(apps.data.length!==1)throw Error('Expected exactly one matching Silicon app');
const app=apps.data[0];
const versions=await get(`/v1/apps/${app.id}/appStoreVersions?limit=20&include=build`);
const builds=await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
const report={checkedAt:new Date().toISOString(),app:{id:app.id,name:app.attributes.name,bundleId:app.attributes.bundleId},versions:versions.data.map(v=>({id:v.id,...v.attributes,buildId:v.relationships?.build?.data?.id})),builds:builds.data.map(b=>({id:b.id,...b.attributes,marketingVersion:builds.included?.find(v=>v.id===b.relationships?.preReleaseVersion?.data?.id)?.attributes?.version})),localizations:[],purchases:[],warnings:[]};
for(const version of versions.data.filter(v=>v.attributes.versionString==='1.4.0')) {
  const locales=await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`);
  for(const l of locales.data) report.localizations.push({id:l.id,locale:l.attributes.locale,whatsNew:l.attributes.whatsNew,supportUrl:l.attributes.supportUrl,descriptionLength:l.attributes.description?.length||0});
  try {
    const detail=(await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data.attributes;
    report.review={contactNamePresent:!!(detail.contactFirstName&&detail.contactLastName),contactEmailPresent:!!detail.contactEmail,contactPhonePresent:!!detail.contactPhone,demoAccountRequired:detail.demoAccountRequired,notes:detail.notes};
  } catch(e) { report.warnings.push(String(e)); }
}
for(const [kind,path] of [['subscriptionGroups',`/v1/apps/${app.id}/subscriptionGroups?limit=50`],['inAppPurchases',`/v1/apps/${app.id}/inAppPurchasesV2?limit=50`]]) {
  try {
    const items=await get(path);
    for(const item of items.data) {
      report.purchases.push({kind,id:item.id,...item.attributes});
      if(kind==='subscriptionGroups') {
        const subs=await get(`/v1/subscriptionGroups/${item.id}/subscriptions?limit=50`);
        report.purchases.push(...subs.data.map(s=>({kind:'subscription',id:s.id,...s.attributes})));
        for(const sub of subs.data) {
          for(const [label,path] of [
            ['introductoryOffers',`/v1/subscriptions/${sub.id}/introductoryOffers?limit=200&filter[territory]=USA`],
            ['prices',`/v1/subscriptions/${sub.id}/prices?limit=200&filter[territory]=USA&include=subscriptionPricePoint`],
            ['availability',`/v1/subscriptions/${sub.id}/subscriptionAvailability`],
          ]) try { report.purchases.push({kind:label,productId:sub.attributes.productId,response:await get(path)}); }
          catch(e) { report.warnings.push(String(e)); }
        }
      }
    }
  } catch(e) { report.warnings.push(String(e)); }
}
report.storeSetup={};
report.storeSetup.serverNotifications = {
  productionConfigured: !!app.attributes.subscriptionStatusUrl,
  sandboxConfigured: !!app.attributes.subscriptionStatusUrlForSandbox,
};
for (const purchase of report.purchases.filter(p => p.kind === 'inAppPurchases')) {
  try {
    const schedule = await get(`/v2/inAppPurchases/${purchase.id}/iapPriceSchedule`);
    report.purchases.push({kind:'iapPrices',productId:purchase.productId,response:await get(`/v1/inAppPurchasePriceSchedules/${schedule.data.id}/manualPrices?filter[territory]=USA&include=inAppPurchasePricePoint`)});
  } catch(e) { report.warnings.push(String(e)); }
}
try {
  const groups = await get(`/v1/apps/${app.id}/betaGroups?limit=200`);
  report.testFlightGroups = [];
  for (const group of groups.data) {
    const groupBuilds = await get(`/v1/betaGroups/${group.id}/builds?limit=200`);
    report.testFlightGroups.push({id:group.id,name:group.attributes.name,isInternalGroup:group.attributes.isInternalGroup,hasAccessToAllBuilds:group.attributes.hasAccessToAllBuilds,builds:groupBuilds.data.map(b=>({id:b.id,number:b.attributes.version}))});
  }
} catch(e) { report.warnings.push(String(e)); }
for(const [label,path] of [
  ['appPrices',`/v1/appPriceSchedules/${app.id}/manualPrices?filter[territory]=USA&include=appPricePoint`],
  ['subscriptionGracePeriod',`/v1/apps/${app.id}/subscriptionGracePeriod`],
  ['appAvailability',`/v1/apps/${app.id}/appAvailabilityV2`],
  ['appInfo',`/v1/apps/${app.id}/appInfos?include=ageRatingDeclaration,primaryCategory,secondaryCategory`],
]) try { report.storeSetup[label]=await get(path); } catch(e) { report.warnings.push(String(e)); }
mkdirSync('artifacts/app-store-inspection',{recursive:true});
writeFileSync('artifacts/app-store-inspection/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
