# docx-corpus

## What it is

docx-corpus is a public dataset and pipeline for collecting, describing, and sharing DOCX files from the
public web for research and testing.

## What it owns

- Discovering, downloading, validating, and deduplicating corpus documents.
- Storing source files and extracted data with stable identities and metadata.
- Text extraction, language detection, embeddings, and classification.
- Publishing corpus data through downloads, APIs, and Hugging Face.

## What it does not own

- SuperDoc rendering, editing, or public API behavior.
- Repairing every malformed DOCX or defining how Word should interpret it.
- Product workflows built by corpus consumers.

## Current direction

- Keep every pipeline stage reproducible and safe to rerun.
- Preserve failures and duplicates as distinct outcomes instead of hiding them.
- Make the corpus useful across document-processing tools, not only SuperDoc.
