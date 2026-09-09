#!/usr/bin/env bash
set -euo pipefail

# ---------------- CONFIG ----------------
BUCKET="polling.picapool.com"
REGION="ap-south-1"
OUT_DIR="./out"
# Optionally set your CloudFront distribution id here, or leave empty to be prompted
CLOUDFRONT_ID=""
# ----------------------------------------

echo "🚀 Starting full deploy for ${BUCKET} ..."

echo
echo "STEP 0) Building Next.js (production)..."
# ensure production build (Next 14 will emit static files to ./out if next.config.js has output: 'export')
NODE_ENV=production npm run build

echo
if [ ! -d "$OUT_DIR" ]; then
  echo "❌ Error: export dir '$OUT_DIR' not found. Next build didn't produce ./out."
  echo "Make sure your next.config.js contains: output: 'export' and images.unoptimized = true (if you use next/image)."
  exit 1
fi

echo
echo "1) Syncing $OUT_DIR -> s3://$BUCKET (delete stale). NOTE: not using --acl to support 'Bucket owner enforced'."
aws s3 sync "$OUT_DIR/" "s3://$BUCKET/" --delete --exact-timestamps

# ensure index.html has cache-control (replace metadata so sync's object is updated)
if [ -f "$OUT_DIR/index.html" ]; then
  echo "2) Updating cache-control for index.html (no-cache)"
  aws s3 cp "$OUT_DIR/index.html" "s3://$BUCKET/index.html" \
    --cache-control "no-cache, max-age=0" --content-type "text/html" --metadata-directive REPLACE
fi

# set html cache-control for other html pages (optional good practice)
echo "2b) Setting cache-control for other .html pages (keeps last-modified from sync)..."
mapfile -t html_files < <(find "$OUT_DIR" -type f -iname '*.html' -not -path "$OUT_DIR/index.html" -not -path "$OUT_DIR/404.html")
for f in "${html_files[@]}"; do
  rel="${f#$OUT_DIR/}"
  echo " - setting cache for /$rel"
  aws s3 cp "$f" "s3://$BUCKET/$rel" --cache-control "no-cache, max-age=0" --content-type "text/html" --metadata-directive REPLACE >/dev/null
done

echo
# Interactive CloudFront invalidation prompt
read -r -p "Create CloudFront invalidation? (y/n) " create_inv
create_inv=${create_inv,,} # lower-case

if [[ "$create_inv" == "y" || "$create_inv" == "yes" ]]; then
  if [[ -z "$CLOUDFRONT_ID" ]]; then
    read -r -p "Enter CloudFront Distribution ID (e.g. E1ABCDEF12345): " input_id
    CLOUDFRONT_ID="$input_id"
  fi

  if [[ -z "$CLOUDFRONT_ID" ]]; then
    echo "❌ No CloudFront ID provided. Skipping invalidation."
  else
    echo "4) Creating CloudFront invalidation for ${CLOUDFRONT_ID} (/*) ..."
    aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*" >/dev/null
    echo "🧹 CloudFront invalidation requested."
  fi
else
  echo "Skipping CloudFront invalidation (you answered no)."
fi

echo
echo "✅ Deployment complete! Test (S3 website endpoints):"
echo " - http://${BUCKET}.s3-website-${REGION}.amazonaws.com/polling (should load /polling/index.html)"
echo
echo "If your domain uses CloudFront/Route53, allow a minute for propagation."

exit 0
