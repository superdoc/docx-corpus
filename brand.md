---
name: "docx-corpus"
tagline: "Every Word document on the public web. Classified and open."
version: 2
language: en
---

# docx-corpus brand

## Positioning

docx-corpus is the largest open corpus of classified Word documents: real `.docx` files from the public web, validated, deduplicated, extracted, and labeled by type, topic, and language.

Document AI research runs on scanned images and PDFs. DOCX, the format people actually write in, had no research dataset. SuperDoc needed one to understand real documents, found none, built it, and opened it.

**Category**: open research corpus for native Word documents.

**What sets it apart**
- The only large-scale open DOCX corpus.
- Raw files, extracted text, embeddings, and labels in one place.
- Sourced from the real public web through Common Crawl, not synthetic or single-domain.
- Maintained by SuperDoc, a team that builds DOCX tooling.

**What it is not**: a document viewer or editor, a SaaS product, a benchmark leaderboard, a PDF dataset, a synthetic collection, a "platform", or a marketing vehicle for SuperDoc.

**Base message**: docx-corpus is the open dataset that document processing research has been missing.

## Voice

**Tone**: direct, technical, matter-of-fact, dry. If it sounds like a startup announcement, it's wrong. If it sounds like a README, it's right.

1. Numbers over adjectives: "736K+ documents", not "a massive collection".
2. Name the mechanism: "content-addressed deduplication via SHA-256", not "advanced deduplication".
3. State limits: "classification averages 82% confidence", not "highly accurate".
4. Use real terms: "Common Crawl WARC archives", not "web data sources".
5. Lead with the answer. Tables before paragraphs when data is comparable.
6. Don't overstate coverage or accuracy.

| Say | Never say |
|---|---|
| "736K+ classified DOCX files" | "The world's most comprehensive document intelligence platform" |
| "Scraped from Common Crawl" | "Powered by cutting-edge web mining technology" |
| "Open dataset on Hugging Face" | "Democratizing access to document data" |
| "Built by SuperDoc — DOCX editing and tooling" | "Backed by industry-leading document technology" |
| "Download the dataset" | "Get started on your document AI journey" |

**Tagline**: Every Word document on the public web. Classified and open. Use it on the homepage, the GitHub README, and the Hugging Face dataset card.

**Attribution**: "Built by SuperDoc — DOCX editing and tooling."

## Visual

The site should read like a well-maintained dataset's documentation page: dense data tables, flat surfaces, generous whitespace, no decoration. `apps/site/src/styles/design.css` implements these rules.

### Color

| Token | Hex | Use |
|---|---|---|
| `--coral` | `#F97B6D` | Decoration only: bar fills, badge backgrounds, borders, hover backgrounds. Never text. |
| `--coral-text` | `#C9493D` | Text only: wordmark, links, kickers, byline. Passes WCAG AA on white (4.66:1). |
| `--text` | `#2D2D2D` | Headings, body, the "corpus" half of the wordmark |
| `--muted` | `#6B7280` | Secondary text, metadata, counts, kickers, section labels |
| `--border` | `#E5E7EB` | All dividers, as 1px hairlines |
| `--code-bg` | `#F9FAFB` | Code blocks |

Coral punctuates and muted gray carries the rest; never tint paragraphs, rows, or large blocks coral. Don't use SuperDoc blue (`#1355FF`), neon colors, or gradients.

### Type

- **Inter** (400, 600) for everything except code.
- **JetBrains Mono** (400, 500) for code, commands, IDs, hashes, and stat values.

| Size | Weight | Use |
|---|---|---|
| 11px | 600 | Section labels, kickers, table headers (uppercase, 0.08em letter-spacing) |
| 12.5px | 400 | Code, inline counts, mono table cells |
| 13px | 400–500 | Nav, table body, footer |
| 14px | 400 | Body |
| 15px | 400 | Subheads, lede |
| 18px | 500 | Stat values (mono) |
| 18px | 600 | Section headings |
| 32px | 700 | Page headings (-0.02em letter-spacing) |

### Layout and components

- **Layout**: 960px page shell. Reading content uses the `.prose` 640px measure; tables, grids, and code use the full shell. Pages have 32px side padding, 56px top and 80px bottom; sections are 56px apart.
- **Surfaces**: no shadows, no gradients, no rounding except 3px on code blocks.
- **Tables**: borderless body with hairlines between rows, a charcoal 1px underline under the header, mono cells for IDs and numbers, no zebra striping or hover background.
- **Stats**: one inline row, 40px gaps, hairlines above and below; the value in mono 18px, the label in muted 13px below it. No stat cards.
- **Code blocks**: light background with a 1px border, 12.5px mono, muted comments. Never a dark theme.
- **Section labels**: small uppercase muted text, optionally with a mono count (`DOCUMENT TYPES · 10`).
- **Kicker**: `OPEN RESEARCH DATASET` above the hero heading, styled like a section label.
