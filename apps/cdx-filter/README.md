# cdx-filter

AWS Lambda that filters one Common Crawl CDX index file for `.docx` URLs and writes them to R2 at `cdx-filtered/{crawl-id}/*.jsonl`. It runs in `us-east-1`, next to Common Crawl's S3 bucket, which avoids the rate limits on Common Crawl's HTTPS API. Invoke it with `bun run corpus cdx-filter` from the repo root.

## Setup

### 1. Create IAM role

```bash
# Create role
aws iam create-role --role-name lambda-cdx-filter \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policies
aws iam attach-role-policy --role-name lambda-cdx-filter \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam create-policy --policy-name commoncrawl-read \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::commoncrawl", "arn:aws:s3:::commoncrawl/*"]
    }]
  }'

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-role-policy --role-name lambda-cdx-filter \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/commoncrawl-read
```

### 2. Deploy

Run from `apps/cdx-filter`:

```bash
bun install
bun run build

source ../../.env
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws lambda create-function \
  --function-name cdx-filter \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::${ACCOUNT_ID}:role/lambda-cdx-filter \
  --memory-size 2048 \
  --timeout 900 \
  --architectures arm64 \
  --region us-east-1 \
  --environment "Variables={R2_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID},R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID},R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY},R2_BUCKET_NAME=${R2_BUCKET_NAME:-docx-corpus}}"
```

### 3. Update (after code changes)

```bash
bun run build
aws lambda update-function-code \
  --function-name cdx-filter \
  --region us-east-1 \
  --zip-file fileb://function.zip
```

## Monitor

```bash
aws logs tail /aws/lambda/cdx-filter --follow --region us-east-1
```
