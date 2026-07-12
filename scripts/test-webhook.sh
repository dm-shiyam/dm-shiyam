#!/bin/bash
# Test Instagram webhook locally by simulating a comment event
# Usage: ./scripts/test-webhook.sh <keyword>
#   Example: ./scripts/test-webhook.sh test

set -e

# Load env vars
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

KEYWORD="${1:-test}"
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3000/api/webhook/instagram}"

# Fake test payload — simulating a comment event
PAYLOAD=$(cat <<EOF
{
  "object": "instagram",
  "entry": [
    {
      "id": "${INSTAGRAM_ACCOUNT_ID:-17841400000000000}",
      "time": $(date +%s),
      "changes": [
        {
          "field": "comments",
          "value": {
            "from": {
              "id": "9999999999999",
              "username": "test_user_curl"
            },
            "media": {
              "id": "18000000000000000",
              "media_product_type": "FEED"
            },
            "id": "18000000000000001",
            "text": "${KEYWORD}"
          }
        }
      ]
    }
  ]
}
EOF
)

# Compute HMAC-SHA256 signature
if [ -z "$INSTAGRAM_APP_SECRET" ]; then
  echo "⚠️  INSTAGRAM_APP_SECRET not set — signature verification will be skipped"
  SIG_HEADER=""
else
  SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$INSTAGRAM_APP_SECRET" | sed 's/^.* //')
  SIG_HEADER="X-Hub-Signature-256: sha256=$SIGNATURE"
  echo "🔐 Signature: sha256=$SIGNATURE"
fi

echo "📤 Sending test webhook to: $WEBHOOK_URL"
echo "🔑 Keyword: $KEYWORD"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "$SIG_HEADER" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\n"
