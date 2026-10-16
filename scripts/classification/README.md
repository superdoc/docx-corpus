# Classification

Labels each document with a type (10 classes) and a topic (9 classes). An LLM labels a small sample, a classifier is trained on it, and the classifier labels the whole corpus. See [`taxonomy.json`](taxonomy.json) for the classes.

## Setup

Requires Python 3.11+.

```bash
pip install -e .
```

The scripts read `DATABASE_URL` and `ANTHROPIC_API_KEY` from the project root `.env`. `ANTHROPIC_API_KEY` is only needed for `label.py`.

## Steps

```bash
# 1. Sample documents, stratified by language, length, and source domain
python sample.py --total 3500 --output sampled_docs.jsonl

# 2. Label the sample with Claude (safe to stop and resume)
python label.py --input sampled_docs.jsonl --output labeled_docs.jsonl

# 3. Train the type and topic classifiers (xlm-roberta-base)
python train.py --input labeled_docs.jsonl --output-dir ./models

# 4. Classify the corpus and write labels to Postgres
python classify.py --models-dir ./models

# 5. Check label quality or the corpus distribution
python evaluate.py labels --input labeled_docs.jsonl
python evaluate.py corpus
```

`corpus classify` from the repo root runs step 4.

## Modal (cloud GPUs)

`train.py` and `classify.py` accept `--modal`; `classify.py` also takes `--workers`. Set up Modal once:

```bash
pip install modal
python -m modal setup
modal secret create docx-db DATABASE_URL="postgres://..."
```

Models are stored in the Modal volume `classifier-models`.
