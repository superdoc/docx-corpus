import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONSENT_KEY, CONSENT_MAX_AGE, initializeAnalyticsConsent, readConsent} from '../apps/site/src/lib/analytics-consent.mjs';
import {analyticsAllowed} from '../apps/site/src/lib/growth-attribution.mjs';

function surface() {
  const storage = new Map(), scripts = [], events = new Map(), cookies = new Map([['_ga', 'old'], ['_ga_OLD', 'old'], ['session', 'necessary']]);
  let now = Date.parse('2026-11-11T20:00:00Z'), reloads = 0;
  const win = {location: {...new URL('https://docxcorp.us/'), href: 'https://docxcorp.us/?utm_source=superdoc.dev#public', hostname: 'docxcorp.us', origin: 'https://docxcorp.us', pathname: '/', reload(){reloads++;}, assign(url){this.assigned=url;}}, navigator: {},
    history: {pushState(){}, replaceState(){}},
    localStorage: {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    addEventListener(name,fn){events.set('window:'+name,fn);},
  };
  const doc = {head:{appendChild:script=>scripts.push(script)}, createElement:()=>({}), visibilityState:'visible',
    addEventListener(name,fn){events.set('document:'+name,fn);},
    get cookie(){return [...cookies].map(([k,v])=>k+'='+v).join('; ');},
    set cookie(value){const name=value.split('=')[0];if(value.includes('Max-Age=0'))cookies.delete(name);},
  };
  const start=()=>initializeAnalyticsConsent({win,doc,measurementId:'G-SYNTHETIC',siteHost:'docxcorp.us',clock:()=>now});
  const saved=analytics=>storage.set(CONSENT_KEY,JSON.stringify({version:1,savedAt:now,analytics}));
  return {win,doc,start,saved,storage,scripts,cookies,events,get reloads(){return reloads;},clock:()=>now,advance:milliseconds=>{now+=milliseconds;}};
}

test('a direct first visit loads no Google tag and does not grant CTA measurement',()=>{
  const s=surface();s.start();assert.equal(s.scripts.length,0);assert.equal(s.win.superdocAnalyticsConsent,false);
  assert.equal(s.win['ga-disable-G-SYNTHETIC'],true);assert.equal(analyticsAllowed(s.win,'docx_corpus'),false);
});
test('only affirmative consent loads one tag with advertising disabled, without replaying prior activity',()=>{
  const s=surface();s.win.dataLayer=[['event','prior_private_activity']];const consent=s.start();consent.save(true);s.start();consent.reconcile();
  assert.equal(s.scripts.length,1);assert.match(s.scripts[0].src,/gtag\/js\?id=G-SYNTHETIC$/);
  assert.equal(analyticsAllowed(s.win,'docx_corpus'),true);assert.equal(s.win['ga-disable-G-SYNTHETIC'],false);
  const calls=s.win.dataLayer.map(args=>[...args]);assert.equal(calls.length,3);
  assert.equal(calls[0][2].ad_storage,'denied');assert.equal(calls[0][2].ad_user_data,'denied');assert.equal(calls[0][2].ad_personalization,'denied');
  assert.equal(calls[2][2].allow_google_signals,false);assert.equal(calls[2][2].page_location,'https://docxcorp.us/');assert.equal(calls[2][2].page_referrer,'');
  assert.doesNotMatch(JSON.stringify(calls),/prior_private_activity|utm_source|#public/);
});
test('rejection is persistent and clears only analytics cookies without reloading a fresh visit',()=>{
  const s=surface(),consent=s.start();consent.save(false);
  assert.equal(readConsent(s.win,s.clock()).analytics,false);assert.equal(s.scripts.length,0);assert.equal(s.reloads,0);
  assert.deepEqual([...s.cookies.keys()],['session']);
});
test('withdrawal blocks later events, clears analytics cookies and reloads once to stop the loaded SDK',()=>{
  const s=surface(),consent=s.start();consent.save(true);const oldGtag=s.win.gtag,before=s.win.dataLayer.length;
  consent.save(false);oldGtag('event','must_not_send');consent.reconcile();
  assert.equal(s.win.dataLayer.length,before);assert.equal(s.win['ga-disable-G-SYNTHETIC'],true);assert.equal(s.win.superdocAnalyticsConsent,false);
  assert.equal(s.reloads,1);assert.deepEqual([...s.cookies.keys()],['session']);
});
test('DNT, GPC and explicit opt-out override a stored grant and an attempted new grant',()=>{
  for(const block of [s=>s.win.navigator.globalPrivacyControl=true,s=>s.win.navigator.doNotTrack='1',s=>s.win.doNotTrack='yes',s=>s.win.superdocAnalyticsOptOut=true]){
    const s=surface();s.saved(true);block(s);const consent=s.start();assert.equal(consent.blocked,true);consent.save(true);
    assert.equal(s.scripts.length,0);assert.equal(s.win.superdocAnalyticsConsent,false);assert.equal(readConsent(s.win,s.clock()).analytics,false);
  }
});
test('malformed, future and expired choices fail closed',()=>{
  for(const value of ['broken','{}',JSON.stringify({version:2,savedAt:0,analytics:true}),JSON.stringify({version:1,savedAt:Date.now()+CONSENT_MAX_AGE,analytics:true}),JSON.stringify({version:1,savedAt:0,analytics:true})]){
    const s=surface();s.storage.set(CONSENT_KEY,value);s.start();assert.equal(s.scripts.length,0);assert.equal(s.win.superdocAnalyticsConsent,false);
  }
});
test('valid returning consent loads the tag, and expiry on an open page stops it',()=>{
  const s=surface();s.saved(true);s.start();assert.equal(s.scripts.length,1);s.advance(CONSENT_MAX_AGE+1);s.events.get('document:click')();
  assert.equal(s.win.superdocAnalyticsConsent,false);assert.equal(s.reloads,1);
});
test('cross-tab withdrawal, clearing storage and a restored page cannot revive an old grant',()=>{
  for(const event of ['window:storage','window:pageshow']){
    const s=surface();s.saved(true);s.start();s.storage.clear();s.events.get(event)({key:null,persisted:true});
    assert.equal(s.win.superdocAnalyticsConsent,false);assert.equal(s.reloads,1);
  }
});
test('storage denial retains a session choice, while a fresh document still defaults off',()=>{
  const s=surface();s.win.localStorage.setItem=()=>{throw Error('Storage unavailable');};const consent=s.start();consent.save(true);consent.reconcile();
  assert.equal(s.win.superdocAnalyticsConsent,true);assert.equal(s.scripts.length,1);
  const fresh=surface();fresh.win.localStorage.getItem=()=>{throw Error('Storage unavailable');};fresh.start();assert.equal(fresh.scripts.length,0);
});
test('private and non-production surfaces never load the tag; SPA auth navigation enters a fresh document',()=>{
  for(const href of ['https://docxcorp.us/sign-in','https://docxcorp.us/auth/callback','https://docxcorp.us/?token=secret','http://localhost/']){
    const s=surface();const u=new URL(href);Object.assign(s.win.location,{href,hostname:u.hostname,origin:u.origin,pathname:u.pathname});s.saved(true);s.start();assert.equal(s.scripts.length,0);
  }
  const s=surface();s.saved(true);s.start();s.win.history.pushState({},'','/sign-in?code=secret');
  assert.equal(s.win.location.assigned,'https://docxcorp.us/sign-in?code=secret');assert.equal(s.win.superdocAnalyticsConsent,false);assert.equal(s.win['ga-disable-G-SYNTHETIC'],true);
});
test('the originating site owns its choice and unknown consent cannot enable a CTA event',()=>{
  const s=surface();s.storage.set('superdoc_cookie_preferences',JSON.stringify({version:1,savedAt:Date.now(),analytics:true,identification:true}));s.start();
  assert.equal(s.scripts.length,0);s.win.gtag=()=>{};assert.equal(analyticsAllowed(s.win,'docx_corpus'),false);
});
test('the HTML entry point has usable privacy controls and no unconditional Google loader',async()=>{
  const html=await readFile(new URL('../apps/site/src/layouts/WidePageLayout.astro',import.meta.url),'utf8');
  assert.doesNotMatch(html,/googletagmanager\.com|gtag\('config'/);
  const controls=await readFile(new URL('../apps/site/src/components/CookiePreferences.astro',import.meta.url),'utf8');
  for(const attribute of ['data-consent-banner','data-consent-dialog','data-consent-accept','data-consent-reject','data-consent-open'])assert.ok(controls.includes(attribute));
  assert.match(controls,/href="\/privacy"/);
});

test('accepted visits retain known ecosystem campaigns and only the public referrer origin',()=>{
  const s=surface();s.win.location.href='https://docxcorp.us/?utm_source=superdoc.dev&utm_medium=referral&utm_campaign=ecosystem&private=secret';s.doc.referrer='https://www.superdoc.dev/private?email=private@example.test';s.start().save(true);
  const config=[...s.win.dataLayer[2]][2];assert.equal(config.campaign_source,'superdoc.dev');assert.equal(config.campaign_medium,'referral');assert.equal(config.campaign_name,'ecosystem');assert.equal(config.page_referrer,'https://www.superdoc.dev/');assert.doesNotMatch(JSON.stringify(config),/private|secret|email/);
});

test('blocked cookie storage or script insertion cannot prevent reading the site',()=>{
  const s=surface();Object.defineProperty(s.doc,'cookie',{get(){throw Error('Cookie access blocked');}});assert.doesNotThrow(()=>s.start());assert.equal(s.win.superdocAnalyticsConsent,false);
  const blocked=surface();blocked.doc.head.appendChild=()=>{throw Error('Script insertion blocked');};assert.doesNotThrow(()=>blocked.start().save(true));assert.equal(blocked.win.superdocAnalyticsConsent,false);
});
