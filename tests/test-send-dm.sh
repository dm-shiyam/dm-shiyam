#!/bin/bash
# ──────────────────────────────────────────────────────────
# Test: Send a DM by triggering the webhook with a signed payload
#
# Usage:
#   bash tests/test-send-dm.sh                        # uses default test IDs
#   bash tests/test-send-dm.sh <real_igsid> <keyword>  # use a real Instagram-scoped user ID
# ──────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Load secrets from .env.local
APP_SECRET=$(grep "^INSTAGRAM_APP_SECRET" "$ENV_FILE" | cut -d= -f2-)
IG_ACCOUNT_ID=$(grep "^INSTAGRAM_ACCOUNT_ID" "$ENV_FILE" | cut -d= -f2-)

if [ -z "$APP_SECRET" ]; then
  echo "❌ INSTAGRAM_APP_SECRET not found in .env.local"
  exit 1
fi

# Recipient ID — use arg or default
RECIPIENT_ID="${1:-$IG_ACCOUNT_ID}"
KEYWORD="${2:-info}"
USERNAME="test_dm_user"

echo "══════════════════════════════════════════"
echo "DM Send Test via Webhook"
echo "══════════════════════════════════════════"
echo ""
echo "  Base URL:     $BASE_URL"
echo "  Recipient ID: $RECIPIENT_ID"
echo "  Keyword:      $KEYWORD"
echo "  Username:     @$USERNAME"
echo ""

# Build the webhook payload (simulates an Instagram comment event)
PAYLOAD=$(cat <<EOF
{"object":"instagram","entry":[{"id":"$IG_ACCOUNT_ID","changes":[{"field":"comments","value":{"from":{"id":"$RECIPIENT_ID","username":"$USERNAME"},"text":"I want $KEYWORD please","id":"comment_$(date +%s)","media":{"id":"media_12345"}}}]}]}
EOF
)

# Generate HMAC-SHA256 signature
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $NF}')"

echo "  Payload:    $(echo "$PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$PAYLOAD")"
echo ""
echo "  Signature:  ${SIGNATURE:0:20}..."
echo ""
echo "──────────────────────────────────────────"
echo "Sending..."
echo ""

# Send the signed webhook request
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/webhook/instagram" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD")

STATUS=$(echo "$HTTP_RESPONSE" | tail -1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

echo "  Response:   $BODY"
echo "  Status:     $STATUS"
echo ""

if [ "$STATUS" = "200" ]; then
  echo "✅ Webhook accepted the payload (DM is being processed async)"
  echo ""
  echo "Check the server logs for:"
  echo "  - [webhook] Comment from @$USERNAME ..."
  echo "  - [webhook] Matched keyword \"$KEYWORD\" ..."
  echo "  - [sendDM] or [webhook] DM sent/failed ..."
else
  echo "❌ Webhook rejected the payload (status $STATUS)"
fi

echo ""
echo "──────────────────────────────────────────"
echo "To check activity log:"
echo "  sqlite3 dm-shiyam.db \"SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 5;\""
echo ""
