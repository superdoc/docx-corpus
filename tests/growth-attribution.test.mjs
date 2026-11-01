import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsAllowed, classifyDestination, ctaPayload, installGrowthAttribution } from '../apps/site/src/lib/growth-attribution.mjs';
function surface() {
  const calls = []; const listeners = new Map();
  const win = { location: { hostname: 'ooxml.dev', origin: 'https://ooxml.dev', pathname: '/' }, navigator: {}, gtag: (...args) => calls.push(args) };
  const doc = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const anchor = { getAttribute: () => 'https://superdoc.dev/?utm_source=ooxml.dev&email=private@example.com', closest: () => null };
  const click = { target: { closest: () => anchor }, button: 0, defaultPrevented: false };
  return { calls, listeners, win, doc, click };
}
test('classifies exact destinations and excludes malformed/credentialed/unrelated URLs', () => {
  assert.equal(classifyDestination('https://docs.superdoc.dev/getting-started/quickstart?secret=x', 'https://ooxml.dev'), 'quickstart');
  for (const href of ['javascript:alert(1)', 'https://superdoc.dev.evil.test/', 'https://private@superdoc.dev/', 'https://superdoc.dev/account?email=x', 'https://superdoc.dev:8443/']) assert.equal(classifyDestination(href, 'https://ooxml.dev'), null);
});
test('payload excludes arbitrary keys and only accepts bounded enums', () => {
  const value = ctaPayload({ sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC', destination: 'superdoc_home', placement: 'footer', email: 'private@example.com', url: 'secret' });
  assert.deepEqual(Object.keys(value).sort(), ['send_to', 'event_version', 'source_project', 'destination', 'placement'].sort());
  assert.equal(ctaPayload({ sourceProject: 'user@example.com', measurementId: 'G-SYNTHETIC', destination: 'superdoc_home', placement: 'footer' }), null);
});
test('respects opt-out, DNT, GPC and private/non-production surfaces', () => {
  for (const mutate of [w => { w.superdocAnalyticsOptOut = true; }, w => { w.navigator.doNotTrack = '1'; }, w => { w.navigator.globalPrivacyControl = true; }, w => { w.location.hostname = 'localhost'; }, w => { w.location.pathname = '/account'; }, w => { w.gtag = undefined; }]) {
    const { win } = surface(); mutate(win); assert.equal(analyticsAllowed(win, 'ooxml_dev'), false);
  }
});
test('single listener preserves navigation and never emits raw link/query data', () => {
  const s = surface(); const stop = installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  assert.equal(s.listeners.size, 1); s.listeners.get('click')(s.click); assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0][1], 'superdoc_cta_clicked'); assert.doesNotMatch(JSON.stringify(s.calls), /private|email=|https:|utm_/);
  stop(); assert.equal(s.listeners.size, 0);
});
test('client-side router prevention does not hide CTA intent', () => {
  const s = surface(); installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  s.click.defaultPrevented = true; s.listeners.get('click')(s.click); assert.equal(s.calls.length, 1);
});
test('provider errors and privacy changes after installation never break a click', () => {
  const s = surface(); installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  s.win.gtag = () => { throw new Error('blocked'); }; assert.doesNotThrow(() => s.listeners.get('click')(s.click));
  s.win.superdocAnalyticsOptOut = true; s.win.gtag = (...args) => s.calls.push(args); s.listeners.get('click')(s.click); assert.equal(s.calls.length, 0);
});
