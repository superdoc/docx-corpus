export const privacyTitle = "Privacy and cookie choices";
export const privacySections = [
	{
		title: "Optional analytics",
		text: "You can use this site without optional analytics cookies. Google Analytics and our referral click measurement stay off until you choose to enable analytics on this site. Google Analytics measures page views and referral activity and may process cookie identifiers and browser or device information. Advertising personalization and Google signals are disabled in our site configuration.",
	},
	{
		title: "Your choice on this site",
		text: "Accept analytics, reject analytics, or open Preferences to choose. Your choice is saved in this browser on this site and is valid for up to 180 days. It is not copied from superdoc.dev or shared across our other sites. Global Privacy Control and Do Not Track signals keep optional analytics off. With JavaScript disabled, optional analytics does not load.",
	},
	{
		title: "Change or withdraw consent",
		text: "Open Cookie settings on any page to change your choice. Turning off analytics clears this site's analytics cookies and reloads the page to stop the loaded tag. Save any edits before withdrawing consent. Withdrawal does not erase data previously received by a provider.",
	},
	{
		title: "Referral click measurement",
		text: "Our custom referral click event records which site and link placement led toward SuperDoc, documentation, pricing or a trial guide. This event excludes document contents, filenames, query strings, contact names and email addresses. A click does not establish a signup, evaluation or purchase.",
	},
	{
		title: "Service requests and privacy rights",
		text: "Necessary service delivery, security processing and any account authentication you request are separate from optional analytics. This site is operated by Harbour Enterprises, Inc., doing business as SuperDoc. Read the SuperDoc privacy policy for details about personal information, recipients, retention and applicable privacy rights. Send privacy questions or requests to privacy@harbourshare.com.",
	},
];
export const privacyLinks = [
	{ label: "SuperDoc privacy policy", href: "https://www.superdoc.dev/privacy-policy" },
	{ label: "Google privacy policy", href: "https://policies.google.com/privacy" },
	{ label: "Privacy questions and requests", href: "mailto:privacy@harbourshare.com" },
];
export function privacyMarkdown(siteHost) {
	return (
		`# ${privacyTitle}\n\nCookie choices for ${siteHost}.\n\n` +
		privacySections.map((section) => `## ${section.title}\n\n${section.text}\n\n`).join("") +
		"## Cookie settings\n\nOpen [Cookie settings](/privacy#cookie-settings) in your browser to change your choice.\n\n" +
		privacyLinks.map((link) => `[${link.label}](${link.href})`).join("\n\n") +
		"\n"
	);
}
