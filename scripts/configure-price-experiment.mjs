// Creates only the six explicitly approved experiment SKUs. Never reprices legacy products.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { asc, sanitized } from './app-store-client.mjs';

const config = JSON.parse(readFileSync('appstore/pricing-experiment-1.4.0.json', 'utf8'));
const protectedIds = new Set(['monthly', 'yearly', 'lifetime'].map(p => `com.wrexist.silicon.pro.${p}`).concat('com.wrexist.silicon.sandbox'));
const allowed = new Map([
  ['com.wrexist.silicon.pro.weekly', '7.99'],
  ['com.wrexist.silicon.pro.yearly.premium', '99.99'],
  ['com.wrexist.silicon.pro.lifetime.premium', '199.99'],
  ['com.wrexist.silicon.pro.weekly.value', '4.99'],
  ['com.wrexist.silicon.pro.yearly.value', '59.99'],
  ['com.wrexist.silicon.pro.lifetime.value', '119.99'],
]);
if (config.appId !== '6778942533' || config.subscriptionGroupId !== '22272528' || config.trialDays !== 7 || config.products.length !== 6 ||
    new Set(config.products.map(p => p.productId)).size !== 6 || config.products.some(p => protectedIds.has(p.productId) || allowed.get(p.productId) !== p.priceUSD)) {
  throw Error('Unexpected pricing experiment manifest');
}
if (process.env.APPLY_PRICING_EXPERIMENT !== '1') throw Error('Explicit APPLY_PRICING_EXPERIMENT=1 required');
const out = 'artifacts/pricing-experiment'; mkdirSync(out, { recursive: true });
const save = (name, data) => writeFileSync(`${out}/${name}.json`, JSON.stringify(sanitized(data), null, 2));
const rel = (type, id) => ({ data: { type, id } });
async function all(path) {
  const data = [], included = [];
  while (path) {
    const page = await asc(path); data.push(...page.data); included.push(...(page.included || []));
    const next = page.links?.next;
    if (next && !next.startsWith('https://api.appstoreconnect.apple.com/')) throw Error('Unexpected pagination host');
    path = next ? next.replace('https://api.appstoreconnect.apple.com', '') : undefined;
  }
  return { data, included };
}
async function missingAllowed(path) {
  try { return (await asc(path)).data; }
  catch (e) { if (String(e).includes(': 404 ')) return null; throw e; }
}
const subs = (await all(`/v1/subscriptionGroups/${config.subscriptionGroupId}/subscriptions?limit=200`)).data;
const iaps = (await all(`/v1/apps/${config.appId}/inAppPurchasesV2?limit=200`)).data;
save('before-products', [...subs, ...iaps]);
const legacy = subs.find(s => s.attributes.productId === 'com.wrexist.silicon.pro.yearly');
if (!legacy || legacy.attributes.state !== 'APPROVED') throw Error('Expected approved legacy subscription');
const availability = (await asc(`/v1/subscriptions/${legacy.id}/subscriptionAvailability`)).data;
const territories = (await all(`/v1/subscriptionAvailabilities/${availability.id}/availableTerritories?limit=200`)).data.map(t => ({ type: 'territories', id: t.id }));
if (!territories.some(t => t.id === 'USA') || territories.length < 150) throw Error('Unexpected source availability');
const territoryIds = new Set(territories.map(t => t.id));
const results = [];
for (const plan of config.products) {
  const recurring = plan.tier !== 'lifetime';
  const type = recurring ? 'subscriptions' : 'inAppPurchases';
  let product = (recurring ? subs : iaps).find(p => p.attributes.productId === plan.productId);
  if (!product) {
    const attributes = recurring
      ? { name: plan.name, productId: plan.productId, subscriptionPeriod: plan.tier === 'weekly' ? 'ONE_WEEK' : 'ONE_YEAR', groupLevel: 1, familySharable: false }
      : { name: plan.name, productId: plan.productId, inAppPurchaseType: 'NON_CONSUMABLE', familySharable: true };
    attributes.reviewNote = 'Silicon Pro price experiment. Same access in both variants. Displayed only in the assigned RevenueCat offering. Existing purchases remain restorable.';
    product = (await asc(recurring ? '/v1/subscriptions' : '/v2/inAppPurchases', 'POST', { type, attributes,
      relationships: recurring ? { group: rel('subscriptionGroups', config.subscriptionGroupId) } : { app: rel('apps', config.appId) } })).data;
  }
  if (protectedIds.has(product.attributes.productId) || product.attributes.productId !== plan.productId) throw Error('Refusing protected product');
  if (recurring && product.attributes.subscriptionPeriod !== (plan.tier === 'weekly' ? 'ONE_WEEK' : 'ONE_YEAR')) throw Error('Existing new product has a different period');
  results.push({ ...plan, appleId: product.id }); save('products', results);
  const base = `${recurring ? '/v1/subscriptions' : '/v2/inAppPurchases'}/${product.id}`;
  const locType = recurring ? 'subscriptionLocalizations' : 'inAppPurchaseLocalizations';
  const locales = (await all(`${base}/${locType}?limit=200`)).data;
  if (!locales.some(l => l.attributes.locale === 'en-US')) await asc(`/v1/${locType}`, 'POST', { type: locType,
    attributes: { name: `Silicon Pro ${plan.tier[0].toUpperCase() + plan.tier.slice(1)}`, locale: 'en-US', description: 'All eras, scenarios, Creative Mode and Time Machine.' },
    relationships: { [recurring ? 'subscription' : 'inAppPurchaseV2']: rel(type, product.id) } });
  const points = (await all(`${base}/pricePoints?filter[territory]=USA&include=territory&limit=200`)).data;
  const point = points.find(p => Number(p.attributes.customerPrice) === Number(plan.priceUSD));
  if (!point) throw Error(`Apple price point unavailable for ${plan.productId}: ${plan.priceUSD}`);
  if (recurring) {
    const existing = (await all(`${base}/prices?include=territory,subscriptionPricePoint&limit=200`)).data;
    const existingByTerritory = new Map(existing.map(p => [p.relationships?.territory?.data?.id, p]));
    const equivalents = (await all(`/v1/subscriptionPricePoints/${point.id}/equalizations?include=territory&limit=200`)).data;
    const prices = [point, ...equivalents].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i && territoryIds.has(p.relationships?.territory?.data?.id));
    if (new Set(prices.map(p => p.relationships.territory.data.id)).size !== territoryIds.size) throw Error('Incomplete equalized prices');
    const missingPrices = [];
    for (const p of prices) {
      const territory = p.relationships.territory.data.id, prior = existingByTerritory.get(territory);
      if (prior) {
        if (prior.relationships.subscriptionPricePoint.data.id !== p.id) throw Error('Existing experiment price differs; refusing overwrite');
        continue;
      }
      missingPrices.push({ type: 'subscriptionPrices', id: '${price-' + territory + '}', attributes: { startDate: null, preserveCurrentPrice: false },
        relationships: { subscription: rel(type, product.id), territory: rel('territories', territory), subscriptionPricePoint: rel('subscriptionPricePoints', p.id) } });
    }
    if (missingPrices.length) {
      console.log('Setting initial regional prices', plan.productId, missingPrices.length);
      await asc(base, 'PATCH', { type, id: product.id, relationships: {
        prices: { data: [...existing.map(p => ({ type: 'subscriptionPrices', id: p.id })), ...missingPrices.map(p => ({ type: p.type, id: p.id }))] },
      } }, missingPrices);
    }
    const offers = (await all(`${base}/introductoryOffers?include=territory&limit=200`)).data;
    const missingOffers = [];
    for (const t of territories) {
      const prior = offers.find(o => o.relationships?.territory?.data?.id === t.id);
      if (prior) {
        if (prior.attributes.offerMode !== 'FREE_TRIAL' || prior.attributes.duration !== 'ONE_WEEK') throw Error('Existing trial differs');
        continue;
      }
      missingOffers.push({ type: 'subscriptionIntroductoryOffers', id: '${trial-' + t.id + '}',
        attributes: { duration: 'ONE_WEEK', numberOfPeriods: 1, offerMode: 'FREE_TRIAL' },
        relationships: { subscription: rel(type, product.id), territory: rel('territories', t.id) } });
    }
    for (const offer of missingOffers) {
      const { id: temporaryId, ...data } = offer;
      for (let attempt = 0; ; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try { await asc('/v1/subscriptionIntroductoryOffers', 'POST', data); break; }
        catch (e) {
          if (attempt >= 2 || !/: (429|500|503) /.test(String(e))) throw e;
          await new Promise(resolve => setTimeout(resolve, 15000));
          // A failed response can follow a successful mutation. Read before retrying.
          const refreshed = (await all(`${base}/introductoryOffers?include=territory&limit=200`)).data;
          const created = refreshed.find(o => o.relationships?.territory?.data?.id === data.relationships.territory.data.id);
          if (created) {
            if (created.attributes.offerMode !== 'FREE_TRIAL' || created.attributes.duration !== 'ONE_WEEK') throw Error('Unexpected trial after transient error');
            break;
          }
        }
      }
    }
  } else {
    const schedule = await missingAllowed(`${base}/iapPriceSchedule`);
    const current = schedule ? (await all(`/v1/inAppPurchasePriceSchedules/${schedule.id}/manualPrices?filter[territory]=USA&include=inAppPurchasePricePoint&limit=200`)).data : [];
    if (current.length && current.some(p => p.relationships.inAppPurchasePricePoint.data.id !== point.id)) throw Error('Existing lifetime experiment price differs');
    if (!current.length) await asc('/v1/inAppPurchasePriceSchedules', 'POST', { type: 'inAppPurchasePriceSchedules', relationships: {
      inAppPurchase: rel(type, product.id), baseTerritory: rel('territories', 'USA'), manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price}' }] },
    } }, [{ type: 'inAppPurchasePrices', id: '${price}', attributes: { startDate: null }, relationships: {
      inAppPurchaseV2: rel(type, product.id), inAppPurchasePricePoint: rel('inAppPurchasePricePoints', point.id),
    } }]);
  }
  const availabilityPath = recurring ? 'subscriptionAvailability' : 'inAppPurchaseAvailability';
  if (!(await missingAllowed(`${base}/${availabilityPath}`))) {
    const avType = recurring ? 'subscriptionAvailabilities' : 'inAppPurchaseAvailabilities';
    await asc(`/v1/${avType}`, 'POST', { type: avType, attributes: { availableInNewTerritories: true }, relationships: {
      [recurring ? 'subscription' : 'inAppPurchase']: rel(type, product.id), availableTerritories: { data: territories },
    } });
  }
  console.log(`Configured ${plan.productId}: US $${plan.priceUSD}, ${territories.length} territories`);
}
save('after-products', [...(await all(`/v1/subscriptionGroups/${config.subscriptionGroupId}/subscriptions?limit=200`)).data,
  ...(await all(`/v1/apps/${config.appId}/inAppPurchasesV2?limit=200`)).data]);
console.log('Created/configured new experiment products. No product has been submitted for review.');

