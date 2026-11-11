export type AnalyticsSiteHost = "ooxml.dev" | "docxcorp.us";
export type MeasurementId = `G-${string}`;
export interface ConsentChoice {
	version: 1;
	savedAt: number;
	analytics: boolean;
}
export interface ConsentController {
	readonly choice: ConsentChoice | null;
	readonly blocked: boolean;
	readonly reloadRequired: boolean;
	save(analytics: boolean): ConsentChoice;
	reconcile(fromStorage?: boolean): void;
}
export interface ConsentOptions {
	measurementId: MeasurementId;
	siteHost: AnalyticsSiteHost;
	win?: any;
	doc?: any;
	clock?: () => number;
}
export const CONSENT_KEY: string;
export const CONSENT_MAX_AGE: number;
export function privacySignal(win: any): boolean;
export function validChoice(value: unknown, now?: number): ConsentChoice | null;
export function readConsent(win: any, now?: number): ConsentChoice | null;
export function publicSurface(location: { href: string }, siteHost: AnalyticsSiteHost): boolean;
export function clearAnalyticsCookies(doc: any, siteHost: AnalyticsSiteHost): void;
export function initializeAnalyticsConsent(options: ConsentOptions): ConsentController | null;
export function installConsentControls(options: ConsentOptions): ConsentController | null;
