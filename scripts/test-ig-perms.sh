#!/bin/bash
# DM Shiyam — Instagram Permissions Smoke Test
#
# Verifies all three Instagram Business Login permissions are working:
#   1. instagram_business_basic       — read profile + media
#   2. instagram_business_manage_comments — read comments (write test is opt-in)
#   3. instagram_business_manage_messages — list conversations (write test is opt-in)
#
# Usage:
#   ./scripts/test-ig-perms.sh                          # uses .env.local defaults
#   IG_TOKEN=... IG_USER_ID=... ./scripts/test-ig-perms.sh   # override
#   ./scripts/test-ig-perms.sh --from-db                # pull first active account from DB
#   ./scripts/test-ig-perms.sh --write-tests            # also run write tests (needs manual IDs)
#
# Exit code:
#   0 = all read tests passed
#   1 = one or more read tests failed
#
# Prereqs: curl, jq (brew install jq)

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

FAILED=0
FROM_DB=0
WRITE_TESTS=0

# ── Arg parsing ─────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --from-db)      FROM_DB=1 ;;
    --write-tests)  WRITE_TESTS=1 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown arg: $arg${NC}"
      exit 1
      ;;
  esac
done

# ── Dependency check ────────────────────────────────────────────────────────
command -v curl >/dev/null 2>&1 || { echo -e "${RED}✗ curl not found${NC}"; exit 1; }
if ! command -v jq >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠ jq not found — install with: brew install jq${NC}"
  echo -e "${YELLOW}  Output will be raw JSON without pretty printing.${NC}\n"
  JQ="cat"
else
  JQ="jq"
fi

# ── Load .env.local ─────────────────────────────────────────────────────────
if [ -f .env.local ] && [ -z "${IG_TOKEN:-}" ]; then
  # shellcheck disable=SC1091
  set -a; source .env.local 2>/dev/null; set +a
  IG_TOKEN="${IG_TOKEN:-${INSTAGRAM_ACCESS_TOKEN:-}}"
  IG_USER_ID="${IG_USER_ID:-${INSTAGRAM_ACCOUNT_ID:-}}"
fi

# ── Pull from DB if requested ───────────────────────────────────────────────
if [ "$FROM_DB" -eq 1 ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}✗ --from-db requires DATABASE_URL in env${NC}"
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo -e "${RED}✗ --from-db requires psql (postgresql-client)${NC}"
    exit 1
  fi

  echo -e "${BLUE}▶ Fetching first active account from DB...${NC}"
  ROW=$(psql "$DATABASE_URL" -tAF'|' -c \
    "SELECT instagram_account_id, access_token, instagram_username
     FROM accounts
     WHERE is_active = TRUE
     ORDER BY created_at ASC
     LIMIT 1;")

  if [ -z "$ROW" ]; then
    echo -e "${RED}✗ No active accounts found in DB${NC}"
    exit 1
  fi

  IG_USER_ID=$(echo "$ROW" | cut -d'|' -f1)
  IG_TOKEN=$(echo "$ROW" | cut -d'|' -f2)
  USERNAME=$(echo "$ROW" | cut -d'|' -f3)
  echo -e "${GREEN}✓ Loaded account: @$USERNAME (id: $IG_USER_ID)${NC}\n"
fi

# ── Validate creds present ──────────────────────────────────────────────────
if [ -z "${IG_TOKEN:-}" ]; then
  echo -e "${RED}✗ IG_TOKEN not set (or INSTAGRAM_ACCESS_TOKEN missing in .env.local)${NC}"
  echo -e "  Usage: IG_TOKEN=... IG_USER_ID=... $0"
  exit 1
fi

if [ -z "${IG_USER_ID:-}" ]; then
  echo -e "${RED}✗ IG_USER_ID not set (or INSTAGRAM_ACCOUNT_ID missing in .env.local)${NC}"
  exit 1
fi

TOKEN_PREVIEW="${IG_TOKEN:0:8}...${IG_TOKEN: -4}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Instagram Permissions Smoke Test${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  IG User ID: ${BOLD}$IG_USER_ID${NC}"
echo -e "  Token:      ${BOLD}$TOKEN_PREVIEW${NC}"
echo ""

BASE="https://graph.instagram.com/v21.0"

# ── Helper: run test, mark pass/fail ────────────────────────────────────────
run_test() {
  local name="$1"; shift
  local url="$1"; shift
  echo -e "${BLUE}▶ $name${NC}"
  local response
  response=$(curl -sS "$url")
  if echo "$response" | grep -q '"error"'; then
    local errmsg
    errmsg=$(echo "$response" | jq -r '.error.message // .error' 2>/dev/null || echo "$response")
    echo -e "  ${RED}✗ FAILED${NC}"
    echo -e "  ${RED}Error: $errmsg${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    return 1
  else
    echo -e "  ${GREEN}✓ PASSED${NC}"
    echo "$response" | $JQ
    echo ""
    return 0
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# TEST 1 — instagram_business_basic
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${YELLOW}[1/3] instagram_business_basic${NC}"
echo -e "     ─────────────────────────────────"

run_test "Fetch profile (me)" \
  "$BASE/me?fields=id,username,account_type,media_count,followers_count&access_token=$IG_TOKEN"

run_test "List recent media (last 3 posts)" \
  "$BASE/$IG_USER_ID/media?fields=id,caption,media_type,permalink,timestamp&limit=3&access_token=$IG_TOKEN"

# Capture first media_id for the next test
FIRST_MEDIA_ID=$(curl -sS "$BASE/$IG_USER_ID/media?fields=id&limit=1&access_token=$IG_TOKEN" \
  | jq -r '.data[0].id // empty' 2>/dev/null || echo "")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 2 — instagram_business_manage_comments
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${YELLOW}[2/3] instagram_business_manage_comments${NC}"
echo -e "     ─────────────────────────────────────────"

if [ -n "$FIRST_MEDIA_ID" ]; then
  run_test "Read comments on latest post ($FIRST_MEDIA_ID)" \
    "$BASE/$FIRST_MEDIA_ID/comments?fields=id,text,username,timestamp&access_token=$IG_TOKEN"
else
  echo -e "  ${YELLOW}⚠ No media found — skipping comment read test${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# TEST 3 — instagram_business_manage_messages
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${YELLOW}[3/3] instagram_business_manage_messages${NC}"
echo -e "     ─────────────────────────────────────────"

run_test "List conversations" \
  "$BASE/$IG_USER_ID/conversations?platform=instagram&access_token=$IG_TOKEN"

# ═══════════════════════════════════════════════════════════════════════════
# OPTIONAL WRITE TESTS (--write-tests)
# ═══════════════════════════════════════════════════════════════════════════
if [ "$WRITE_TESTS" -eq 1 ]; then
  echo -e "${BOLD}${YELLOW}[WRITE TESTS] Manual — supply COMMENT_ID and RECIPIENT_IGSID env vars${NC}"
  echo -e "     ────────────────────────────────────────────────────────────────"

  if [ -n "${COMMENT_ID:-}" ]; then
    echo -e "${BLUE}▶ POST reply to comment $COMMENT_ID${NC}"
    RESP=$(curl -sS -X POST "$BASE/$COMMENT_ID/replies" \
      -d "message=Test reply from test-ig-perms.sh (please ignore)" \
      -d "access_token=$IG_TOKEN")
    if echo "$RESP" | grep -q '"error"'; then
      echo -e "  ${RED}✗ FAILED — $(echo "$RESP" | jq -r '.error.message')${NC}"
      FAILED=$((FAILED + 1))
    else
      echo -e "  ${GREEN}✓ Reply posted — id: $(echo "$RESP" | jq -r '.id')${NC}"
    fi
    echo ""
  else
    echo -e "  ${YELLOW}⏭  Skipping comment reply test (set COMMENT_ID=... to enable)${NC}\n"
  fi

  if [ -n "${RECIPIENT_IGSID:-}" ]; then
    echo -e "${BLUE}▶ POST DM to recipient $RECIPIENT_IGSID${NC}"
    RESP=$(curl -sS -X POST "$BASE/$IG_USER_ID/messages" \
      -H "Content-Type: application/json" \
      -d "{\"recipient\":{\"id\":\"$RECIPIENT_IGSID\"},\"message\":{\"text\":\"Test DM from test-ig-perms.sh (please ignore)\"},\"access_token\":\"$IG_TOKEN\"}")
    if echo "$RESP" | grep -q '"error"'; then
      echo -e "  ${RED}✗ FAILED — $(echo "$RESP" | jq -r '.error.message')${NC}"
      echo -e "  ${YELLOW}  Note: recipient must have messaged you in the last 24 hours.${NC}"
      FAILED=$((FAILED + 1))
    else
      echo -e "  ${GREEN}✓ DM sent — message_id: $(echo "$RESP" | jq -r '.message_id')${NC}"
    fi
    echo ""
  else
    echo -e "  ${YELLOW}⏭  Skipping DM send test (set RECIPIENT_IGSID=... to enable)${NC}\n"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${BOLD}${GREEN}  ✅ ALL TESTS PASSED${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}Next steps:${NC}"
  echo -e "  • For write tests (reply / DM), grab a real COMMENT_ID from test 2 output"
  echo -e "    and a RECIPIENT_IGSID from a follower who DMed you in last 24hr, then run:"
  echo -e "    ${BOLD}COMMENT_ID=... RECIPIENT_IGSID=... $0 --write-tests${NC}"
  echo -e "  • For multi-account testing, run: ${BOLD}$0 --from-db${NC} (rotates through accounts)"
  exit 0
else
  echo -e "${BOLD}${RED}  ❌ $FAILED TEST(S) FAILED${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}Common causes:${NC}"
  echo -e "  • Token expired          → run: ./scripts/refresh-token.sh <new_short_lived_token>"
  echo -e "  • Missing permission     → revoke app from IG settings, re-connect via OAuth"
  echo -e "  • Wrong IG_USER_ID       → verify with: curl \"$BASE/me?fields=id&access_token=\$IG_TOKEN\""
  echo -e "  • App not in Live mode   → check Meta App Dashboard → App Mode"
  exit 1
fi
