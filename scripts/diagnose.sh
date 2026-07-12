#!/bin/bash
# DM Shiyam — Diagnostic Script
# Checks common issues that prevent DMs from working
# Usage: ./scripts/diagnose.sh

set +e  # Don't exit on errors; we want to run all checks

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "  ${BLUE}ℹ️  $1${NC}"; }
header() { echo -e "\n${BLUE}▶ $1${NC}"; }

echo "═════════════════════════════════════════════"
echo "  DM Shiyam — Diagnostic Check"
echo "═════════════════════════════════════════════"

# ─── 1. Env file ────────────────────────────────
header "1. Environment variables (.env.local)"
if [ ! -f .env.local ]; then
  fail ".env.local not found — copy from .env.example and fill in values"
  exit 1
fi
pass ".env.local exists"

# Load env safely
set -a
source .env.local 2>/dev/null
set +a

REQUIRED_VARS=(
  "INSTAGRAM_APP_ID"
  "INSTAGRAM_APP_SECRET"
  "INSTAGRAM_ACCESS_TOKEN"
  "INSTAGRAM_ACCOUNT_ID"
  "WEBHOOK_VERIFY_TOKEN"
  "NEXTAUTH_SECRET"
  "DATABASE_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
  val="${!var}"
  if [ -z "$val" ] || [[ "$val" == *"your_"* ]] || [[ "$val" == *"xxxxxx"* ]]; then
    fail "$var is missing or placeholder"
  else
    # Mask sensitive values
    masked="${val:0:8}...${val: -4}"
    pass "$var is set ($masked)"
  fi
done

# ─── 2. Dev server ──────────────────────────────
header "2. Dev server (localhost:3000)"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 3 | grep -q "200\|307\|308"; then
  pass "Dev server is running on port 3000"
else
  fail "Dev server not running — start it with: npm run dev"
fi

# ─── 3. Postgres ────────────────────────────────
header "3. Postgres database"
if command -v psql &> /dev/null; then
  if [ -n "$DATABASE_URL" ]; then
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
      pass "Postgres is reachable"
      # Count key tables
      USER_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null)
      AUTO_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM automations WHERE is_active = true;" 2>/dev/null)
      ACCT_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM accounts;" 2>/dev/null)
      info "Users: $USER_COUNT, Active automations: $AUTO_COUNT, Connected accounts: $ACCT_COUNT"
      if [ "$AUTO_COUNT" -eq "0" ] 2>/dev/null; then
        warn "No active automations — create one in the dashboard first"
      fi
    else
      fail "Cannot connect to Postgres — check DATABASE_URL"
    fi
  else
    fail "DATABASE_URL not set"
  fi
else
  warn "psql not installed — skipping DB checks (install: brew install postgresql@16)"
fi

# ─── 4. ngrok ───────────────────────────────────
header "4. ngrok tunnel"
NGROK_API="http://localhost:4040/api/tunnels"
if curl -s "$NGROK_API" --max-time 3 > /dev/null 2>&1; then
  TUNNEL_URL=$(curl -s "$NGROK_API" | grep -o '"public_url":"https[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$TUNNEL_URL" ]; then
    pass "ngrok running: $TUNNEL_URL"
    info "Meta webhook URL should be: $TUNNEL_URL/api/webhook/instagram"
  else
    fail "ngrok running but no HTTPS tunnel found"
  fi
else
  fail "ngrok not running — start with: ngrok http 3000"
fi

# ─── 5. Instagram token ─────────────────────────
header "5. Instagram access token validity"
if [ -n "$INSTAGRAM_ACCESS_TOKEN" ] && [[ ! "$INSTAGRAM_ACCESS_TOKEN" == *"your_"* ]]; then
  TOKEN_CHECK=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=$INSTAGRAM_ACCESS_TOKEN")
  if echo "$TOKEN_CHECK" | grep -q '"id"'; then
    IG_ID=$(echo "$TOKEN_CHECK" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    IG_NAME=$(echo "$TOKEN_CHECK" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    pass "Token valid — connected as: $IG_NAME (id: $IG_ID)"

    # Check token expiry
    DEBUG=$(curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$INSTAGRAM_ACCESS_TOKEN&access_token=$INSTAGRAM_APP_ID|$INSTAGRAM_APP_SECRET")
    EXPIRES=$(echo "$DEBUG" | grep -o '"expires_at":[0-9]*' | cut -d':' -f2)
    if [ -n "$EXPIRES" ] && [ "$EXPIRES" != "0" ]; then
      NOW=$(date +%s)
      DAYS_LEFT=$(( (EXPIRES - NOW) / 86400 ))
      if [ "$DAYS_LEFT" -lt 7 ]; then
        warn "Token expires in $DAYS_LEFT day(s) — refresh soon!"
      else
        info "Token expires in $DAYS_LEFT day(s)"
      fi
    else
      info "Token has no expiry (never-expires or system user token)"
    fi
  else
    ERROR_MSG=$(echo "$TOKEN_CHECK" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    fail "Token invalid: $ERROR_MSG"
    info "Regenerate at: https://developers.facebook.com/tools/explorer/"
  fi
else
  fail "INSTAGRAM_ACCESS_TOKEN is not set"
fi

# ─── 6. Webhook subscription ────────────────────
header "6. Meta webhook subscription"
if [ -n "$INSTAGRAM_APP_ID" ] && [ -n "$INSTAGRAM_APP_SECRET" ]; then
  APP_TOKEN="$INSTAGRAM_APP_ID|$INSTAGRAM_APP_SECRET"
  SUBS=$(curl -s "https://graph.facebook.com/v21.0/$INSTAGRAM_APP_ID/subscriptions?access_token=$APP_TOKEN")
  if echo "$SUBS" | grep -q '"object"'; then
    if echo "$SUBS" | grep -q '"object":"instagram"'; then
      pass "Instagram webhook subscription exists"
      CALLBACK=$(echo "$SUBS" | grep -o '"callback_url":"[^"]*"' | head -1 | cut -d'"' -f4)
      info "Callback URL: $CALLBACK"
      if [[ "$CALLBACK" != *"$TUNNEL_URL"* ]] && [ -n "$TUNNEL_URL" ]; then
        warn "Callback URL doesn't match current ngrok URL — update in Meta Dashboard!"
      fi
    else
      warn "Webhook subscribed but not to Instagram object"
    fi
  else
    fail "No webhook subscriptions found — configure in Meta App Dashboard"
  fi
fi

# ─── 7. Local webhook health ────────────────────
header "7. Local webhook endpoint"
HEALTH=$(curl -s -X GET "http://localhost:3000/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=$WEBHOOK_VERIFY_TOKEN&hub.challenge=test123" --max-time 5)
if [ "$HEALTH" = "test123" ]; then
  pass "Webhook verification endpoint works"
else
  fail "Webhook verification failed — response: $HEALTH"
fi

# ─── 8. Recent webhook events ───────────────────
header "8. Webhook health status"
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  LAST_WEBHOOK=$(psql "$DATABASE_URL" -tAc "SELECT MAX(last_event_at) FROM webhook_health;" 2>/dev/null)
  if [ -n "$LAST_WEBHOOK" ]; then
    info "Last webhook event received at: $LAST_WEBHOOK"
  else
    warn "No webhook events received yet"
  fi
fi

echo ""
echo "═════════════════════════════════════════════"
echo "  Diagnostic complete"
echo "═════════════════════════════════════════════"
echo ""
echo "Common fixes:"
echo "  • If token invalid → regenerate at https://developers.facebook.com/tools/explorer/"
echo "  • If ngrok URL changed → update webhook callback in Meta App Dashboard"
echo "  • If no automations → create one in dashboard with matching keyword"
echo "  • If DMs not sending → check terminal logs for '[sendDM] API error'"
