// Keep this small consent controller identical in ooxml.dev and docxcorp.us.
// Each origin owns its own choice. No homepage visit or cross-domain ID is used.
export const CONSENT_KEY = "superdoc_site_analytics_consent";
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const INSTALLED = new WeakMap();

export function privacySignal(win) {
	return (
		win?.navigator?.globalPrivacyControl === true ||
		win?.superdocAnalyticsOptOut === true ||
		[win?.navigator?.doNotTrack, win?.doNotTrack].some((value) =>
			["1", "yes"].includes(String(value).trim().toLowerCase()),
		)
	);
}
export function validChoice(value, now = Date.now()) {
	return value?.version === 1 &&
		typeof value.analytics === "boolean" &&
		Number.isFinite(value.savedAt) &&
		value.savedAt <= now &&
		now - value.savedAt <= CONSENT_MAX_AGE
		? value
		: null;
}
export function readConsent(win, now = Date.now()) {
	try {
		return validChoice(JSON.parse(win.localStorage.getItem(CONSENT_KEY)), now);
	} catch {
		return null;
	}
}
export function publicSurface(location, siteHost) {
	try {
		const url = new URL(location.href);
		// OAuth responses may put credentials in either the query or fragment,
		// including hash-router callback queries. Inspect decoded parameter names.
		const fragment = new URLSearchParams(url.hash.slice(1).replace(/^[^?]*\?/, ""));
		const privateParameter =
			/^(token|access_token|id_token|refresh_token|client_secret|key|email|auth|session|code|state)$/i;
		return (
			url.protocol === "https:" &&
			[siteHost, "www." + siteHost].includes(url.hostname) &&
			!url.port &&
			!url.username &&
			!url.password &&
			!/^\/(account|checkout|trial|sign-in|sign-up|auth)(?:\/|$)/.test(url.pathname) &&
			![...url.searchParams.keys(), ...fragment.keys()].some((key) => privateParameter.test(key))
		);
	} catch {
		return false;
	}
}
export function clearAnalyticsCookies(doc, siteHost) {
	let visible = "";
	try {
		visible = doc.cookie || "";
	} catch {
		return;
	}
	const names = visible
		.split(";")
		.map((cookie) => cookie.trim().split("=")[0])
		.filter((name) => /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name));
	for (const name of names)
		for (const domain of ["", `; Domain=${siteHost}`, `; Domain=.${siteHost}`]) {
			try {
				doc.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax`;
			} catch {
				/* A blocked cookie jar must not block reading the site. */
			}
		}
}

// Preserve existing public ecosystem attribution without forwarding arbitrary
// query values, referring paths or private URL fragments to the provider.
export function publicAttribution(location, referrer) {
	const params = new URL(location.href).searchParams,
		campaign = {};
	const fields = {
		utm_source: [
			"campaign_source",
			[
				"superdoc.dev",
				"www.superdoc.dev",
				"ooxml.dev",
				"docxcorp.us",
				"docx.tools",
				"docs.superdoc.dev",
			],
		],
		utm_medium: ["campaign_medium", ["referral", "social", "email"]],
		utm_campaign: ["campaign_name", ["ecosystem", "footer", "customer_welcome"]],
	};
	for (const [key, [field, values]] of Object.entries(fields))
		if (values.includes(params.get(key))) campaign[field] = params.get(key);
	let page_referrer = "";
	try {
		const url = new URL(referrer);
		if (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			/^(www\.)?(superdoc\.dev|ooxml\.dev|docxcorp\.us|docx\.tools|google\.com|bing\.com|linkedin\.com|github\.com|chatgpt\.com|claude\.ai)$/.test(
				url.hostname,
			)
		)
			page_referrer = url.origin + "/";
	} catch {
		/* Unknown referrers stay absent. */
	}
	return { page_referrer, ...campaign };
}

export function initializeAnalyticsConsent({
	measurementId,
	siteHost,
	win = globalThis.window,
	doc = globalThis.document,
	clock = Date.now,
}) {
	if (!win || !doc) return null;
	if (!/^G-[A-Z0-9]+$/.test(measurementId) || !["ooxml.dev", "docxcorp.us"].includes(siteHost))
		throw Error("Unknown analytics configuration");
	if (INSTALLED.has(win)) return INSTALLED.get(win);
	let choice = readConsent(win, clock()),
		loaded = false,
		persisted = true,
		reloading = false;
	const allowed = () =>
		validChoice(choice, clock())?.analytics === true &&
		!privacySignal(win) &&
		publicSurface(win.location, siteHost);
	const reload = () => {
		if (!reloading) {
			reloading = true;
			win.location.reload();
		}
	};
	const apply = () => {
		const enabled = allowed();
		win.superdocAnalyticsConsent = enabled;
		win["ga-disable-" + measurementId] = !enabled;
		if (!enabled) {
			clearAnalyticsCookies(doc, siteHost);
			if (loaded) reload(); // Removing a script alone does not stop its running SDK.
			return false;
		}
		if (!loaded) {
			loaded = true;
			// Nothing collected before the affirmative choice is replayed on consent.
			win.dataLayer = [];
			win.gtag = function () {
				if (allowed()) win.dataLayer.push(arguments);
			};
			win.gtag("consent", "default", {
				analytics_storage: "granted",
				ad_storage: "denied",
				ad_user_data: "denied",
				ad_personalization: "denied",
			});
			win.gtag("js", new Date(clock()));
			win.gtag("config", measurementId, {
				page_location: win.location.origin + win.location.pathname,
				...publicAttribution(win.location, doc.referrer),
				allow_google_signals: false,
				allow_ad_personalization_signals: false,
			});
			const script = doc.createElement("script");
			script.id = "site-google-analytics";
			script.async = true;
			script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
			try {
				doc.head.appendChild(script);
			} catch {
				loaded = false;
				win.superdocAnalyticsConsent = false;
				win["ga-disable-" + measurementId] = true;
				return false;
			}
		}
		return true;
	};
	const reconcile = (fromStorage = false) => {
		if (persisted || fromStorage) choice = readConsent(win, clock());
		apply();
	};
	const controller = {
		get choice() {
			return validChoice(choice, clock());
		},
		get blocked() {
			return privacySignal(win);
		},
		get reloadRequired() {
			return loaded;
		},
		save(analytics) {
			choice = {
				version: 1,
				savedAt: clock(),
				analytics: analytics === true && !privacySignal(win),
			};
			try {
				win.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
				persisted = true;
			} catch {
				persisted = false;
			}
			apply();
			return choice;
		},
		reconcile,
	};
	INSTALLED.set(win, controller);
	// Recheck expiry and privacy signals before a CTA listener can emit an event.
	doc.addEventListener("click", () => reconcile(), true);
	doc.addEventListener("visibilitychange", () => {
		if (doc.visibilityState === "visible") reconcile();
	});
	win.addEventListener("pageshow", () => reconcile());
	win.addEventListener("storage", (event) => {
		if (event.key === CONSENT_KEY || event.key === null) reconcile(true);
	});
	for (const method of ["pushState", "replaceState"]) {
		if (!win.history?.[method]) continue;
		const original = win.history[method].bind(win.history);
		win.history[method] = function (state, title, target) {
			const next = target ? new URL(target, win.location.href) : null;
			if (next && publicSurface(next, siteHost) !== publicSurface(win.location, siteHost)) {
				win.superdocAnalyticsConsent = false;
				win["ga-disable-" + measurementId] = true;
				win.location.assign(next.href);
				return;
			}
			return original(state, title, target);
		};
	}
	apply();
	return controller;
}

export function installConsentControls(options) {
	const win = options.win ?? globalThis.window,
		doc = options.doc ?? globalThis.document;
	const controller = initializeAnalyticsConsent({ ...options, win, doc });
	if (!controller) return null;
	const banner = doc.querySelector("[data-consent-banner]"),
		dialog = doc.querySelector("[data-consent-dialog]");
	if (!banner || !dialog || dialog.dataset.installed) return controller;
	dialog.dataset.installed = "true";
	const checkbox = dialog.querySelector("[data-consent-analytics]");
	const update = () => {
		checkbox.checked = controller.choice?.analytics === true && !controller.blocked;
		checkbox.disabled = controller.blocked;
		for (const button of doc.querySelectorAll("[data-consent-accept]"))
			button.disabled = controller.blocked;
		for (const message of doc.querySelectorAll("[data-consent-signal]"))
			message.hidden = !controller.blocked;
		dialog.querySelector("[data-consent-reload]").hidden = !controller.reloadRequired;
		dialog.querySelector("[data-consent-save]").textContent = controller.reloadRequired
			? "Save choices (reloads if turned off)"
			: "Save choices";
		dialog.querySelector("[data-consent-reject]").textContent = controller.reloadRequired
			? "Reject and reload"
			: "Reject analytics";
	};
	const close = () => {
		dialog.close();
		banner.hidden = Boolean(controller.choice);
	};
	const show = () => {
		update();
		dialog.showModal();
	};
	const save = (value) => {
		controller.save(value);
		banner.hidden = true;
		dialog.close();
	};
	banner.hidden = Boolean(controller.choice);
	update();
	doc.addEventListener("click", (event) => {
		const target = event.target.closest?.(
			"[data-consent-accept],[data-consent-reject],[data-consent-open],[data-consent-save],[data-consent-close]",
		);
		if (!target) return;
		if (target.hasAttribute("data-consent-open")) {
			event.preventDefault();
			show();
		} else if (target.hasAttribute("data-consent-close")) close();
		else if (target.hasAttribute("data-consent-accept")) save(true);
		else if (target.hasAttribute("data-consent-reject")) save(false);
		else if (target.hasAttribute("data-consent-save")) save(checkbox.checked);
	});
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
		close();
	});
	win.addEventListener("storage", (event) => {
		if (event.key === CONSENT_KEY || event.key === null) {
			update();
			banner.hidden = Boolean(controller.choice);
		}
	});
	return controller;
}
