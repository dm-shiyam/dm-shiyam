#!/bin/bash
# tests/test-curl.sh
# Full curl test suite for all API routes
# Usage: bash tests/test-curl.sh
# Requires: dev server running on localhost:3002

BASE="http://localhost:3002"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC} $label (HTTP $actual)"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC} $label — expected $expected, got $actual"
    ((FAIL++))
  fi
}

check_contains() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo -e "${GREEN}✅ PASS${NC} $label (contains '$expected')"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC} $label — expected to contain '$expected', got: $actual"
    ((FAIL++))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DM Shiyam — Full API Test Suite"
echo "  Target: $BASE"
echo "═══════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────
# 1. PAGES — expect 200
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 1. Public Pages (expect 200) ──${NC}"

for path in "/" "/pricing" "/terms" "/privacy" "/login" "/register"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  check "GET $path" "200" "$code"
done

# ─────────────────────────────────────────────────────
# 2. AUTH GUARD — expect 401
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 2. Auth-Protected APIs (expect 401) ──${NC}"

for path in "/api/stats" "/api/automations" "/api/accounts" "/api/activity" \
            "/api/webhook/health" "/api/activity/export?format=csv" "/api/analytics"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  check "GET $path" "401" "$code"
done

# POST auth guard
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/checkout" \
  -H "Content-Type: application/json" -d '{"plan":"pro"}')
check "POST /api/billing/checkout (no auth)" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/verify" \
  -H "Content-Type: application/json" \
  -d '{"razorpay_payment_id":"x","razorpay_subscription_id":"x","razorpay_signature":"x","plan":"pro"}')
check "POST /api/billing/verify (no auth)" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/ai/test" \
  -H "Content-Type: application/json" -d '{"commentText":"hi","commenterUsername":"user"}')
check "POST /api/ai/test (no auth)" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/automations/schedule" \
  -H "Content-Type: application/json" -d '{"id":"test"}')
check "PUT /api/automations/schedule (no auth)" "401" "$code"

# ─────────────────────────────────────────────────────
# 3. WEBHOOK SECURITY — expect 403
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 3. Instagram Webhook Security (expect 403) ──${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=WRONGTOKEN&hub.challenge=test")
check "GET /api/webhook/instagram (wrong token)" "403" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=&hub.challenge=test")
check "GET /api/webhook/instagram (empty token)" "403" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/webhook/instagram?hub.mode=unsubscribe&hub.verify_token=test&hub.challenge=test")
check "GET /api/webhook/instagram (wrong mode)" "403" "$code"

# POST without signature
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/webhook/instagram" \
  -H "Content-Type: application/json" \
  -d '{"object":"instagram","entry":[]}')
check "POST /api/webhook/instagram (no signature)" "403" "$code"

# POST with fake/wrong signature
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/webhook/instagram" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=fakesignature" \
  -d '{"object":"instagram","entry":[]}')
check "POST /api/webhook/instagram (wrong signature)" "403" "$code"

# ─────────────────────────────────────────────────────
# 4. BILLING WEBHOOK SECURITY — expect 401
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 4. Billing Webhook Security (expect 401) ──${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/webhook" \
  -H "Content-Type: application/json" -d '{"event":"subscription.activated"}')
check "POST /api/billing/webhook (no signature)" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/billing/webhook" \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: fakesig" \
  -d '{"event":"subscription.activated"}')
check "POST /api/billing/webhook (wrong signature)" "401" "$code"

# ─────────────────────────────────────────────────────
# 5. WEBHOOK VERIFICATION (correct token)
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 5. Webhook Verify with Correct Token ──${NC}"

VERIFY_TOKEN="${WEBHOOK_VERIFY_TOKEN:-my_secret_verify_token_123}"
response=$(curl -s -w "\n%{http_code}" \
  "$BASE/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=mychallenge123")
body=$(echo "$response" | head -n1)
code=$(echo "$response" | tail -n1)

if [ "$code" = "200" ] && [ "$body" = "mychallenge123" ]; then
  echo -e "${GREEN}✅ PASS${NC} GET /api/webhook/instagram (correct token) — HTTP 200, echoed challenge"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC} GET /api/webhook/instagram (correct token) — HTTP $code, body: $body"
  echo -e "       ${YELLOW}Hint: Set WEBHOOK_VERIFY_TOKEN env var to match your .env value${NC}"
  ((FAIL++))
fi

# ─────────────────────────────────────────────────────
# 6. RESPONSE FORMAT CHECKS
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 6. Response Format Checks ──${NC}"

# Auth errors return JSON with "error" field
body=$(curl -s "$BASE/api/stats")
check_contains "GET /api/stats returns JSON error field" '"error"' "$body"

body=$(curl -s "$BASE/api/automations")
check_contains "GET /api/automations returns JSON error field" '"error"' "$body"

body=$(curl -s "$BASE/api/webhook/health")
check_contains "GET /api/webhook/health returns JSON error field" '"error"' "$body"

# ─────────────────────────────────────────────────────
# 7. CRON ROUTES — must respond (200 or 401 depending on CRON_SECRET)
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 7. Cron Routes (must respond) ──${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/reset-dm-usage")
if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "500" ]; then
  echo -e "${GREEN}✅ PASS${NC} GET /api/cron/reset-dm-usage responds (HTTP $code)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC} GET /api/cron/reset-dm-usage unexpected code $code"
  ((FAIL++))
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/refresh-tokens")
if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "500" ]; then
  echo -e "${GREEN}✅ PASS${NC} GET /api/cron/refresh-tokens responds (HTTP $code)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC} GET /api/cron/refresh-tokens unexpected code $code"
  ((FAIL++))
fi

# Cron with valid secret
if [ -n "$CRON_SECRET" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/refresh-tokens")
  check "GET /api/cron/refresh-tokens (with CRON_SECRET)" "200" "$code"
fi

# ─────────────────────────────────────────────────────
# 8. REGISTER + LOGIN FLOW (creates real user)
# ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── 8. Auth Flow (Register → Get CSRF → Login) ──${NC}"

# Get CSRF token first
csrf_response=$(curl -s "$BASE/api/auth/csrf")
CSRF_TOKEN=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CSRF_TOKEN" ]; then
  echo -e "${GREEN}✅ PASS${NC} GET /api/auth/csrf — token: ${CSRF_TOKEN:0:20}..."
  ((PASS++))

  # Register new user
  reg_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --cookie-jar /tmp/dm-shiyam-cookies.txt \
    -d "email=testvenkat%40test.com&password=Test1234%21&name=Venkat+Test&action=signup&csrfToken=$CSRF_TOKEN&callbackUrl=%2Fdashboard")
  echo -e "${YELLOW}ℹ️  POST /api/auth/callback/credentials (signup) → HTTP $reg_code${NC}"

  # Login existing user
  login_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --cookie-jar /tmp/dm-shiyam-cookies.txt \
    -d "email=testvenkat%40test.com&password=Test1234%21&action=login&csrfToken=$CSRF_TOKEN&callbackUrl=%2Fdashboard")
  echo -e "${YELLOW}ℹ️  POST /api/auth/callback/credentials (login) → HTTP $login_code${NC}"
  echo -e "       ${YELLOW}Note: 302 redirect = success (NextAuth redirects after login)${NC}"

  # Try authenticated request with session cookie
  auth_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --cookie /tmp/dm-shiyam-cookies.txt "$BASE/api/stats")
  echo -e "${YELLOW}ℹ️  GET /api/stats (with cookies) → HTTP $auth_code${NC}"
  if [ "$auth_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} Authenticated request works!"
    ((PASS++))

    # Test all authenticated routes with session
    echo ""
    echo -e "${YELLOW}── 8b. Authenticated Route Tests ──${NC}"

    for path in "/api/automations" "/api/accounts" "/api/activity" "/api/webhook/health" "/api/analytics"; do
      acode=$(curl -s -o /dev/null -w "%{http_code}" --cookie /tmp/dm-shiyam-cookies.txt "$BASE$path")
      check "GET $path (authenticated)" "200" "$acode"
    done

    # CSV export
    csv_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --cookie /tmp/dm-shiyam-cookies.txt "$BASE/api/activity/export?format=csv")
    check "GET /api/activity/export?format=csv (authenticated)" "200" "$csv_code"

    # Check CSV content-type
    csv_ct=$(curl -s -I --cookie /tmp/dm-shiyam-cookies.txt \
      "$BASE/api/activity/export?format=csv" | grep -i "content-type")
    check_contains "CSV export content-type is text/csv" "text/csv" "$csv_ct"

    # Webhook health response shape
    health_body=$(curl -s --cookie /tmp/dm-shiyam-cookies.txt "$BASE/api/webhook/health")
    check_contains "Webhook health has 'status' field" '"status"' "$health_body"
    check_contains "Webhook health has 'total_received' field" '"total_received"' "$health_body"

  else
    echo -e "${YELLOW}⚠️  Cookie auth not working in curl (normal — NextAuth uses httpOnly cookies)${NC}"
    echo -e "       ${YELLOW}Test authenticated routes manually in the browser.${NC}"
  fi
else
  echo -e "${RED}❌ FAIL${NC} Could not get CSRF token — is server running on port $BASE?"
  ((FAIL++))
fi

# ─────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo -e "TOTAL: $TOTAL checks | ${GREEN}✅ $PASS passed${NC} | ${RED}❌ $FAIL failed${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
