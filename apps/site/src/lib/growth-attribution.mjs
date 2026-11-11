// Growth contract v1: aggregate first-party CTA signals, never document/user content.
const PROJECTS = Object.freeze({
  homepage: ['superdoc.dev', 'www.superdoc.dev'],
  ooxml_dev: ['ooxml.dev', 'www.ooxml.dev'],
  docx_tools: ['docx.tools', 'www.docx.tools'],
  docx_corpus: ['docxcorp.us', 'www.docxcorp.us'],
  docs: ['docs.superdoc.dev'],
});
const PLACEMENTS = new Set(['header', 'footer', 'hero', 'content', 'pricing']);
const INSTALLED = new WeakMap();

export function analyticsAllowed(win, sourceProject) {
  return Boolean(Object.hasOwn(PROJECTS, sourceProject) && PROJECTS[sourceProject]?.includes(win?.location?.hostname) &&
    win?.superdocAnalyticsConsent === true &&
    typeof win?.gtag === 'function' &&
    win?.navigator?.globalPrivacyControl !== true &&
    ![win?.navigator?.doNotTrack, win?.doNotTrack].some(value => ['1', 'yes'].includes(String(value).trim().toLowerCase())) &&
    win?.superdocAnalyticsOptOut !== true &&
    !/^\/(account|checkout|trial|sign-in|sign-up)(?:\/|$)/.test(win?.location?.pathname ?? ''));
}

// Classify locally. Observed URLs, queries, fragments, referrers, anchor text
// and document IDs are never copied into this event.
export function classifyDestination(href, origin) {
  let url;
  try { url = new URL(href, origin); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname === 'docs.superdoc.dev') return ['/quickstart', '/getting-started', '/getting-started/quickstart', '/editor/quickstart'].includes(url.pathname.replace(/\/+$/, '') || '/') ? 'quickstart' : 'docs';
  if (!['superdoc.dev', 'www.superdoc.dev'].includes(url.hostname)) return null;
  if (url.hash === '#pricing' || url.pathname === '/pricing') return 'pricing';
  if (url.pathname === '/business-signup') return 'signup';
  if (url.pathname === '/' && !url.hash) return 'superdoc_home';
  return null;
}

export function ctaPayload({ sourceProject, measurementId, destination, placement }) {
  if (!Object.hasOwn(PROJECTS, sourceProject) || !/^G-[A-Z0-9]+$/.test(measurementId ?? '') ||
      !['superdoc_home', 'docs', 'quickstart', 'pricing', 'signup'].includes(destination) ||
      !PLACEMENTS.has(placement)) return null;
  return Object.freeze({ send_to: measurementId, event_version: 'growth-v1',
    source_project: sourceProject, destination, placement,
    // gtag otherwise inherits location, title and referrer from the page.
    // These event-scoped constants do not change the site's existing tag config.
    page_location: `https://${PROJECTS[sourceProject][0]}/`,
    page_title: `SuperDoc / ${sourceProject}`, page_referrer: '' });
}

export function installGrowthAttribution({ sourceProject, measurementId, win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || !doc || !Object.hasOwn(PROJECTS, sourceProject) || !/^G-[A-Z0-9]+$/.test(measurementId ?? '')) return () => {};
  if (INSTALLED.has(doc)) return () => {};
  const click = event => {
    try {
      if (!analyticsAllowed(win, sourceProject) || event.button > 0) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      const destination = classifyDestination(anchor.getAttribute('href'), win.location.origin);
      if (!destination) return;
      // Only external referrals or a specific conversion CTA, never ordinary home navigation.
      if (sourceProject === 'homepage' && destination === 'superdoc_home') return;
      if (sourceProject === 'docs' && ['docs', 'quickstart'].includes(destination)) return;
      const explicit = anchor.closest('[data-growth-placement]')?.getAttribute('data-growth-placement');
      const placement = PLACEMENTS.has(explicit) ? explicit : anchor.closest('footer') ? 'footer' : anchor.closest('header, nav') ? 'header' : 'content';
      const payload = ctaPayload({ sourceProject, measurementId, destination, placement });
      if (payload) win.gtag('event', 'superdoc_cta_clicked', payload);
    } catch { /* Analytics must never interrupt navigation or the developer tool. */ }
  };
  doc.addEventListener('click', click, { passive: true, capture: true });
  INSTALLED.set(doc, click);
  return () => {
    if (INSTALLED.get(doc) === click) { doc.removeEventListener('click', click, true); INSTALLED.delete(doc); }
  };
}
