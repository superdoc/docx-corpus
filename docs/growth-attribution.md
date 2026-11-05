# Growth attribution v1

This adds aggregate `superdoc_cta_clicked` events to the existing GA4 property.
It does not add another analytics tag, page_view, cookie, identifier or outreach
trigger. Existing UTM links remain unchanged. Anonymous engagement never creates
a named lead. These are CTA clicks, not signups, activation or successful payment.

Payload: event_version, source_project, bounded destination and placement, send_to,
plus event-scoped page_location, page_title and page_referrer overrides. Location
is the fixed canonical project root, title is a fixed project label, and referrer
is empty. Observed page/link URLs, queries, fragments, referrers, anchor text,
identity, file names, document contents, OOXML, prompts and free text are not copied
into this event. Only exact production hostnames emit events.
GPC, DNT and `window.superdocAnalyticsOptOut` suppress these added events; existing
GA consent controls continue to apply. This change does not alter existing tags.
The existing Google tag may attach its normal consent-dependent technical/session
metadata; this is not a claim of anonymous collection or a change to other events.
See Google's [configuration reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
for the inherited page-context defaults these event-scoped constants replace.

## Reviewer validation

Run `node --test tests/growth-attribution.test.mjs` and the project's web build.
In a production-like browser journey, open GA4 DebugView with your own browser
Debug setting, follow an existing SuperDoc CTA, and verify exactly one event with
only the fields above and the correct site's measurement ID. No page_view should
be added by this module. Repeat with GPC/DNT/opt-out and confirm no added event.
Do not upload a real customer document for validation.

After merge/deployment, compare referral clicks and downstream hand-raises by
source over complete 28-day periods. Keep source property counts separate; do not
sum them into unique people. Server-confirmed signup/activation/payment events
need their own authoritative receipt and deduplication; a CTA cannot stand in.
