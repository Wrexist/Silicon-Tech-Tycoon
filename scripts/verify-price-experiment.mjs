import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync('appstore/pricing-experiment-1.4.0.json', 'utf8'));
const script = resolve('scripts/configure-price-experiment.mjs');
function rejected(config, apply, expected) {
  const dir = mkdtempSync(join(tmpdir(), 'silicon-pricing-'));
  try {
    mkdirSync(join(dir, 'appstore'));
    writeFileSync(join(dir, 'appstore/pricing-experiment-1.4.0.json'), JSON.stringify(config));
    const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', env: {
      ...process.env, APPLY_PRICING_EXPERIMENT: apply,
      APP_STORE_CONNECT_KEY_ID: '', APP_STORE_CONNECT_ISSUER_ID: '', APP_STORE_CONNECT_API_KEY_BASE64: '',
    } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /Missing App Store Connect credentials/);
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('silicon-pricing-'));
    rmSync(dir, { recursive: true, force: true });
  }
}
test('requires explicit mutation mode before credentials or API access', () => rejected(manifest, '', /Explicit APPLY/));
test('refuses any legacy product even if its price matches', () => {
  const config = structuredClone(manifest); config.products[0].productId = 'com.wrexist.silicon.pro.monthly';
  rejected(config, '1', /Unexpected pricing/);
});
test('refuses changed prices', () => {
  const config = structuredClone(manifest); config.products[0].priceUSD = '79.99';
  rejected(config, '1', /Unexpected pricing/);
});
test('refuses duplicate products or another app', () => {
  const config = structuredClone(manifest); config.products[1] = config.products[0];
  rejected(config, '1', /Unexpected pricing/);
  rejected({ ...manifest, appId: 'other' }, '1', /Unexpected pricing/);
});
