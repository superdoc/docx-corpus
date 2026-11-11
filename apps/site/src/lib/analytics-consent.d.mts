export const CONSENT_KEY: string;
export const CONSENT_MAX_AGE: number;
export function privacySignal(win: any): boolean;
export function validChoice(value: any, now?: number): any;
export function readConsent(win: any, now?: number): any;
export function publicSurface(location: any, siteHost: string): boolean;
export function clearAnalyticsCookies(doc: any, siteHost: string): void;
export function initializeAnalyticsConsent(options: {
	measurementId: string;
	siteHost: string;
	win?: any;
	doc?: any;
	clock?: () => number;
}): any;
export function installConsentControls(options: {
	measurementId: string;
	siteHost: string;
	win?: any;
	doc?: any;
	clock?: () => number;
}): any;
