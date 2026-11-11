import type { APIRoute } from 'astro';
import { privacyMarkdown } from '../lib/privacy-content.mjs';

export const GET: APIRoute = () => new Response(privacyMarkdown('docxcorp.us'), {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
});
