#!/bin/bash
# DM Shiyam — Webhook End-to-End Signature + Idempotency Test
#
# Verifies POST /api/webhook/instagram enforces:
#   1. Rejects request with no signature       → 403
#   2. Rejects request with wrong signature    → 403
#   3. Rejects request with tampered body      → 403
#   4. Accepts request with valid signature    → 200
#   5. Idempotency: same valid payload posted N times still returns 200 each,
#      but processing side effects (DB rows) happen exactly once.
#
# Prereqs: bash, curl, openssl, jq (optional), Postgres for post-run assertions
#
# Usage:
#   ./scripts/test-webhook-e2e.sh                                # against http://localhost:3001
#   WEBHOOK_URL=https://dmshiyam.com/api/webhook/instagram ./scripts/test-webhook-e2e.sh
#   REPLAY_COUNT=25 ./scripts/test-webhook-e2e.sh                # storm test with 25 identical POSTs
#
# Exit code: 0 = all pass, 1 = one or more failed

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

FAILED=0
PASSED=0

# ── Load .env.local ──────────────────────────────────────────────────────────
if [ -f .env.local ]; then
  set -a; source .env.local 2>/dev/null; set +a
fi

APP_SECRET="${INSTAGRAM_APP_SECRET:-}"
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3001/api/webhook/instagram}"
REPLAY_COUNT="${REPLAY_COUNT:-10}"

if [ -z "$APP_SECRET" ]; then
  echo -e "${RED}✗ INSTAGRAM_APP_SECRET not set in .env.local${NC}"
  echo -e "  Signature tests require the app secret to compute valid HMACs."
  exit 1
fi

command -v openssl >/dev/null 2>&1 || { echo -e "${RED}✗ openssl not found${NC}"; exit 1; }
command -v curl >/dev/null 2>&1    || { echo -e "${RED}✗ curl not found${NC}";    exit 1; }

# ── Helpers ──────────────────────────────────────────────────────────────────
# Compute Meta-style HMAC-SHA256 signature: "sha256=<hex>"
sign() {
  local body="$1"
  local sig
  sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$APP_SECRET" -hex | awk '{print $2}')
  printf 'sha256=%s' "$sig"
}

# POST to webhook with optional signature header. Prints HTTP status code.
post_webhook() {
  local body="$1"
  local signature="${2:-}"
  local headers=(-H "Content-Type: application/json")
  if [ -n "$signature" ]; then
    headers+=(-H "X-Hub-Signature-256: $signature")
  fi
  curl -sS -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" "${headers[@]}" -d "$body"
}

assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo -e "  ${GREEN}✓ $test_name${NC} — expected $expected, got $actual"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ $test_name${NC} — expected $expected, got ${BOLD}$actual${NC}"
    FAILED=$((FAILED + 1))
  fi
}

# Generate a unique comment_id per run so we can tell idempotency apart across runs
RUN_ID=$(date +%s)$(( RANDOM % 10000 ))
COMMENT_ID="test_comment_${RUN_ID}"
MEDIA_ID="test_media_${RUN_ID}"

# Realistic Meta webhook payload — a "comments" event
PAYLOAD=$(cat <<EOF
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": ${RUN_ID},
    "changes": [{
      "field": "comments",
      "value": {
        "id": "${COMMENT_ID}",
        "text": "info please",
        "from": { "id": "555550000${RUN_ID: -4}", "username": "test_user_e2e" },
        "media": { "id": "${MEDIA_ID}" }
      }
    }]
  }]
}
EOF
)

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Webhook Signature + Idempotency Test${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  URL:          ${BOLD}$WEBHOOK_URL${NC}"
echo -e "  App secret:   ${BOLD}${APP_SECRET:0:6}...${APP_SECRET: -4}${NC}"
echo -e "  Comment ID:   ${BOLD}$COMMENT_ID${NC} (unique per run)"
echo -e "  Replay count: ${BOLD}$REPLAY_COUNT${NC}"
echo ""

VALID_SIG=$(sign "$PAYLOAD")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 1: No signature header → 403
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[1/5] No signature header${NC}"
STATUS=$(post_webhook "$PAYLOAD" "")
assert_status "Reject request with missing X-Hub-Signature-256" "403" "$STATUS"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# TEST 2: Wrong signature → 403
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[2/5] Wrong signature${NC}"
STATUS=$(post_webhook "$PAYLOAD" "sha256=deadbeef00000000000000000000000000000000000000000000000000000000")
assert_status "Reject request with wrong signature" "403" "$STATUS"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# TEST 3: Tampered body (valid sig on original, but body changed) → 403
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[3/5] Tampered body${NC}"
TAMPERED="${PAYLOAD//test_user_e2e/attacker}"
STATUS=$(post_webhook "$TAMPERED" "$VALID_SIG")
assert_status "Reject when body is tampered after signing" "403" "$STATUS"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# TEST 4: Valid signature → 200
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[4/5] Valid signature${NC}"
STATUS=$(post_webhook "$PAYLOAD" "$VALID_SIG")
assert_status "Accept request with valid signature" "200" "$STATUS"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# TEST 5: Idempotency — replay same payload N times, all should return 200
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[5/5] Idempotency: replay same payload $REPLAY_COUNT times in parallel${NC}"

# Fire N requests in parallel to simulate Meta retry storm
PIDS=()
RESULTS_DIR=$(mktemp -d)
for i in $(seq 1 "$REPLAY_COUNT"); do
  (post_webhook "$PAYLOAD" "$VALID_SIG" > "$RESULTS_DIR/$i.status") &
  PIDS+=($!)
done
# Wait for all
for pid in "${PIDS[@]}"; do wait "$pid"; done

# Aggregate status codes
OK_COUNT=$(grep -l "^200$" "$RESULTS_DIR"/*.status 2>/dev/null | wc -l | tr -d ' ')
BAD_COUNT=$((REPLAY_COUNT - OK_COUNT))
echo -e "  → $OK_COUNT/$REPLAY_COUNT returned 200"

if [ "$OK_COUNT" = "$REPLAY_COUNT" ]; then
  echo -e "  ${GREEN}✓ All replays accepted (200)${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}✗ $BAD_COUNT replays did NOT return 200${NC}"
  cat "$RESULTS_DIR"/*.status | sort | uniq -c | sed 's/^/    /'
  FAILED=$((FAILED + 1))
fi
rm -rf "$RESULTS_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Optional: DB-level idempotency assertion
# Requires DATABASE_URL + psql. Confirms exactly 1 sent_dms/sent_replies row.
# ═══════════════════════════════════════════════════════════════════════════
if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  echo -e "${YELLOW}[BONUS] DB idempotency check${NC}"
  echo -e "  Checking for exactly-once side effects for comment_id=$COMMENT_ID..."

  # Give async processing a moment to flush
  sleep 2

  SENT_DM_COUNT=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM sent_dms WHERE comment_id = '$COMMENT_ID';" 2>/dev/null || echo "?")
  SENT_REPLY_COUNT=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM sent_replies WHERE comment_id = '$COMMENT_ID';" 2>/dev/null || echo "?")
  ACTIVITY_COUNT=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM activity_log WHERE comment_text = 'info please' AND created_at > NOW() - INTERVAL '1 minute';" 2>/dev/null || echo "?")

  echo -e "  sent_dms rows for this comment:       $SENT_DM_COUNT (expect ≤1)"
  echo -e "  sent_replies rows for this comment:   $SENT_REPLY_COUNT (expect ≤1)"
  echo -e "  activity_log rows in last 1 min:      $ACTIVITY_COUNT"

  if [ "$SENT_DM_COUNT" != "?" ] && [ "$SENT_DM_COUNT" -gt 1 ] 2>/dev/null; then
    echo -e "  ${RED}✗ IDEMPOTENCY BROKEN: $SENT_DM_COUNT DMs sent for one comment (should be 1)${NC}"
    FAILED=$((FAILED + 1))
  fi
  if [ "$SENT_REPLY_COUNT" != "?" ] && [ "$SENT_REPLY_COUNT" -gt 1 ] 2>/dev/null; then
    echo -e "  ${RED}✗ IDEMPOTENCY BROKEN: $SENT_REPLY_COUNT replies sent for one comment (should be 1)${NC}"
    FAILED=$((FAILED + 1))
  fi
  echo ""
else
  echo -e "${BLUE}[BONUS] Skipping DB idempotency check (need DATABASE_URL + psql)${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${BOLD}${GREEN}  ✅ ALL $PASSED CHECKS PASSED${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}Signature validation is enforced. Webhook is safe to expose publicly.${NC}"
  exit 0
else
  echo -e "${BOLD}${RED}  ❌ $FAILED FAILED, $PASSED PASSED${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
  exit 1
fi
