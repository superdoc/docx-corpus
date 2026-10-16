# docx-corpus

A public dataset and pipeline that collects, describes, and shares DOCX files from the public web for research and testing.

## Owns

- Finding, downloading, validating, and deduplicating documents.
- Storing files and extracted data with stable IDs and metadata.
- Text extraction, language detection, embeddings, and classification.
- Publishing the corpus through downloads, the API, and Hugging Face.

## Does not own

- Rendering, editing, or application APIs for documents.
- Repairing every malformed DOCX, or defining how Word interprets it.
- Products that corpus users build on top of it.

## Direction

- Keep every pipeline stage reproducible and safe to rerun.
- Record failures and duplicates as distinct outcomes; don't hide them.
- Make the corpus useful across document-processing tools.
