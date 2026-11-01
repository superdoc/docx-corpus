export function analyticsAllowed(win: any, sourceProject: string): boolean;
export function classifyDestination(href: string, origin: string): string | null;
export function ctaPayload(input: { sourceProject: string; measurementId: string; destination: string; placement: string }): Record<string, string> | null;
export function installGrowthAttribution(input: { sourceProject: string; measurementId: string; win?: any; doc?: any }): () => void;
