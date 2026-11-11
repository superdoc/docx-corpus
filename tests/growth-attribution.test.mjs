import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsAllowed, classifyDestination, ctaPayload, installGrowthAttribution } from "../apps/site/src/lib/growth-attribution.mjs";
function surface() {
  const calls = [], listeners = new Map();
  const navigation = { prevented: 0, stopped: 0, assigned: 0, replaced: 0 };
  const win = { location: { hostname: 'ooxml.dev', origin: 'https://ooxml.dev', pathname: '/', href: 'https://ooxml.dev/', assign() { navigation.assigned++; }, replace() { navigation.replaced++; } }, navigator: {}, superdocAnalyticsConsent: true, gtag: (...args) => calls.push(args) };
  const doc = {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { const callbacks = listeners.get(name); callbacks?.delete(fn); if (!callbacks?.size) listeners.delete(name); },
  };
  const anchor = { getAttribute: () => 'https://superdoc.dev/?utm_source=ooxml.dev&email=private@example.com', closest: () => null };
  const click = { target: { closest: () => anchor }, button: 0, defaultPrevented: false,
    preventDefault() { navigation.prevented++; this.defaultPrevented = true; }, stopPropagation() { navigation.stopped++; } };
  const dispatch = () => { for (const callback of [...(listeners.get('click') ?? [])]) callback(click); };
  const listenerCount = () => [...listeners.values()].reduce((count, callbacks) => count + callbacks.size, 0);
  return { calls, listeners, win, doc, click, anchor, navigation, dispatch, listenerCount };
}
test('classifies exact destinations and excludes malformed/credentialed/unrelated URLs', () => {
  assert.equal(classifyDestination('https://docs.superdoc.dev/getting-started/quickstart?secret=x', 'https://ooxml.dev'), 'quickstart');
  for (const href of ['javascript:alert(1)', 'https://superdoc.dev.evil.test/', 'https://private@superdoc.dev/', 'https://superdoc.dev/account?email=x', 'https://superdoc.dev:8443/']) assert.equal(classifyDestination(href, 'https://ooxml.dev'), null);
});
test('payload excludes arbitrary keys and only accepts bounded enums', () => {
  const value = ctaPayload({ sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC', destination: 'superdoc_home', placement: 'footer', email: 'private@example.com', url: 'secret' });
  assert.deepEqual(Object.keys(value).sort(), ['send_to', 'event_version', 'source_project', 'destination', 'placement', 'page_location', 'page_title', 'page_referrer'].sort());
  assert.equal(value.page_location, 'https://ooxml.dev/');
  assert.equal(value.page_referrer, '');
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
  assert.equal(s.listenerCount(), 1); s.dispatch(); assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0][1], 'superdoc_cta_clicked'); assert.doesNotMatch(JSON.stringify(s.calls), /private|email=|utm_/);
  assert.equal(s.click.defaultPrevented, false);
  assert.deepEqual(s.navigation, { prevented: 0, stopped: 0, assigned: 0, replaced: 0 });
  assert.equal(s.win.location.href, 'https://ooxml.dev/');
  let otherClicks = 0; const otherListener = () => { otherClicks++; };
  s.doc.addEventListener('click', otherListener);
  assert.equal(s.listenerCount(), 2);
  stop(); assert.equal(s.listenerCount(), 1);
  s.dispatch(); assert.equal(otherClicks, 1); assert.equal(s.calls.length, 1);
  s.doc.removeEventListener('click', otherListener); assert.equal(s.listenerCount(), 0);
});
test('event context replaces inherited page URL, title and referrer with constants', () => {
  const s = surface();
  s.win.location.href = 'https://ooxml.dev/private-file?email=private@example.com#secret';
  s.doc.title = 'Private document title';
  s.doc.referrer = 'https://customer.example/private-case';
  const inherited = { page_location: s.win.location.href, page_title: s.doc.title, page_referrer: s.doc.referrer };
  s.win.gtag = (_command, _name, payload) => s.calls.push({ ...inherited, ...payload });
  installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  s.dispatch();
  assert.equal(s.calls[0].page_location, 'https://ooxml.dev/');
  assert.equal(s.calls[0].page_title, 'SuperDoc / ooxml_dev');
  assert.equal(s.calls[0].page_referrer, '');
  assert.doesNotMatch(JSON.stringify(s.calls), /private|Private|secret|customer\.example/);
});
test('client-side router prevention does not hide CTA intent', () => {
  const s = surface(); installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  s.click.defaultPrevented = true; s.dispatch(); assert.equal(s.calls.length, 1);
});
test('provider errors and privacy changes after installation never break a click', () => {
  const s = surface(); installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
  s.win.gtag = () => { throw new Error('blocked'); }; assert.doesNotThrow(() => s.dispatch());
  s.win.superdocAnalyticsOptOut = true; s.win.gtag = (...args) => s.calls.push(args); s.dispatch(); assert.equal(s.calls.length, 0);
});

test('either modern or legacy DNT opt-out suppresses the added event', () => {
  for (const [modern, legacy] of [['', '1'], ['0', 'yes'], ['unspecified', 'YES'], ['1', '0']]) {
    const s = surface(); s.win.navigator.doNotTrack = modern; s.win.doNotTrack = legacy;
    installGrowthAttribution({ ...s, sourceProject: 'ooxml_dev', measurementId: 'G-SYNTHETIC' });
    s.dispatch(); assert.equal(s.calls.length, 0);
  }
});
test('inherited project names are rejected at each analytics boundary', () => {
  for (const sourceProject of ['constructor', '__proto__', 'toString']) {
    const s = surface(); assert.equal(analyticsAllowed(s.win, sourceProject), false);
    assert.equal(ctaPayload({ sourceProject, measurementId: 'G-SYNTHETIC', destination: 'pricing', placement: 'footer' }), null);
    assert.doesNotThrow(() => installGrowthAttribution({ ...s, sourceProject, measurementId: 'G-SYNTHETIC' }));
    assert.equal(s.listenerCount(), 0);
  }
});
test('only explicit quickstart paths count as quickstart, including the current editor route', () => {
  for (const path of ['/editor/quickstart', '/editor/quickstart/', '/getting-started/quickstart']) assert.equal(classifyDestination('https://docs.superdoc.dev' + path + '?private=x', 'https://ooxml.dev'), 'quickstart');
  for (const path of ['/resources/quickstart-notes', '/editor/quickstart-other', '/resources/getting-started-security']) assert.equal(classifyDestination('https://docs.superdoc.dev' + path, 'https://ooxml.dev'), 'docs');
});
test('a docs install does not turn ordinary in-docs navigation into referral traffic', () => {
  for (const href of ['https://docs.superdoc.dev/editor/comments', 'https://docs.superdoc.dev/editor/quickstart']) {
    const s = surface(); s.win.location.hostname = 'docs.superdoc.dev'; s.win.location.origin = 'https://docs.superdoc.dev';
    s.anchor.getAttribute = () => href;
    installGrowthAttribution({ ...s, sourceProject: 'docs', measurementId: 'G-SYNTHETIC' });
    s.dispatch(); assert.equal(s.calls.length, 0);
  }
});

test('absent or rejected consent blocks CTA events without changing navigation',()=>{
  for (const choice of [false,undefined]) {
    const s=surface(); if(choice===undefined) delete s.win.superdocAnalyticsConsent; else s.win.superdocAnalyticsConsent=choice;
    assert.equal(analyticsAllowed(s.win,'docx_corpus'),false);
    installGrowthAttribution({...s,sourceProject:'docx_corpus',measurementId:'G-SYNTHETIC'}); s.dispatch();
    assert.equal(s.calls.length,0); assert.equal(s.click.defaultPrevented,false);
    assert.deepEqual(s.navigation,{prevented:0,stopped:0,assigned:0,replaced:0});
  }
});
