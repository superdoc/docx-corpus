# Site analytics consent

Google Analytics and the existing SuperDoc referral click event require an affirmative analytics choice on this origin. A homepage visit or cookie choice on another domain does not grant access. The necessary local choice is versioned and expires after 180 days. Malformed, future and expired records fail closed. DNT, GPC and the existing explicit opt-out override a grant.

Cookie settings remain available on every page. Withdrawing a loaded provider disables its measurement flag, blocks the custom event, clears this site's GA cookies and reloads the document. The dialog warns users to save edits first. Other tabs and restored pages recheck the saved choice. Auth and private capability URLs never start the provider; SPA transitions across that boundary use a fresh document. Local development and previews do not send analytics to the production property.

The UI, server HTML and Markdown notice use the same substantive notice content. `/privacy`, `/privacy.md`, the footer, sitemap and agent index connect the notice and controls. Google signals and advertising personalization are disabled. Known ecosystem campaign tags and public referring origins are retained after consent; raw queries, referring paths and fragments are excluded from the initial configuration. The existing bounded CTA payload remains unchanged.

Run `bun run test:growth` for both the event and consent boundary tests. Test direct arrivals without a stored choice, rejection and reload, preferences with an unchecked analytics box, acceptance and revisit, withdrawal, privacy signals and narrow screens. Provider loading after consent is covered by isolated production-host controller tests. Local browser previews validate UI and rejected-visit network behavior without sending test events to a production analytics property.

This change does not add visitor identification, change SuperDoc's homepage consent controls or change sales qualification, outreach, review approvals or schedules.
