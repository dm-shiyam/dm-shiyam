#!/bin/bash
# DM Shiyam — Token Refresh Helper
# Exchanges a short-lived Instagram/Facebook token for a long-lived (60-day) one
# and updates INSTAGRAM_ACCESS_TOKEN in .env.local
#
# Usage:
#   ./scripts/refresh-token.sh <short_lived_token>
#
# How to get a short-lived token:
#   1. Go to https://developers.facebook.com/tools/explorer/
#   2. Select your app + IG Business user
#   3. Add scopes: instagram_basic, instagram_manage_messages,
#      instagram_manage_comments, pages_show_list, pages_read_engagement,
#      business_management
#   4. Click "Generate Access Token" and copy it

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
  echo -e "${RED}Usage: $0 <short_lived_token>${NC}"
  echo ""
  echo "Get a token from: https://developers.facebook.com/tools/explorer/"
  exit 1
fi

SHORT_TOKEN="$1"

if [ ! -f .env.local ]; then
  echo -e "${RED}.env.local not found — run this from the project root${NC}"
  exit 1
fi

# Load app credentials
set -a
source .env.local
set +a

if [ -z "$INSTAGRAM_APP_ID" ] || [ -z "$INSTAGRAM_APP_SECRET" ]; then
  echo -e "${RED}INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET missing in .env.local${NC}"
  exit 1
fi

echo -e "${BLUE}▶ Validating short-lived token...${NC}"
CHECK=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=$SHORT_TOKEN")
if ! echo "$CHECK" | grep -q '"id"'; then
  echo -e "${RED}✗ Token invalid:${NC} $CHECK"
  exit 1
fi
NAME=$(echo "$CHECK" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
ID=$(echo "$CHECK" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo -e "${GREEN}✓ Token belongs to: $NAME (id: $ID)${NC}"

echo -e "\n${BLUE}▶ Exchanging for long-lived token...${NC}"
EXCHANGE=$(curl -s "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$INSTAGRAM_APP_ID&client_secret=$INSTAGRAM_APP_SECRET&fb_exchange_token=$SHORT_TOKEN")

LONG_TOKEN=$(echo "$EXCHANGE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
EXPIRES_IN=$(echo "$EXCHANGE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

if [ -z "$LONG_TOKEN" ]; then
  echo -e "${RED}✗ Exchange failed:${NC} $EXCHANGE"
  exit 1
fi

DAYS=$(( EXPIRES_IN / 86400 ))
echo -e "${GREEN}✓ Long-lived token obtained (expires in ~$DAYS days)${NC}"

# Backup then update .env.local
cp .env.local .env.local.bak
echo -e "${YELLOW}⏺ Backup saved to .env.local.bak${NC}"

# Portable in-place replace (works on macOS + Linux)
if grep -q '^INSTAGRAM_ACCESS_TOKEN=' .env.local; then
  # Use a delimiter unlikely to appear in tokens
  awk -v new="INSTAGRAM_ACCESS_TOKEN=$LONG_TOKEN" \
    'BEGIN{done=0} /^INSTAGRAM_ACCESS_TOKEN=/{print new; done=1; next} {print} END{if(!done) print new}' \
    .env.local.bak > .env.local
else
  echo "INSTAGRAM_ACCESS_TOKEN=$LONG_TOKEN" >> .env.local
fi

echo -e "${GREEN}✓ Updated INSTAGRAM_ACCESS_TOKEN in .env.local${NC}"

echo -e "\n${BLUE}▶ Verifying new token...${NC}"
VERIFY=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=$LONG_TOKEN")
if echo "$VERIFY" | grep -q '"id"'; then
  echo -e "${GREEN}✓ New token verified${NC}"
else
  echo -e "${RED}✗ Verification failed:${NC} $VERIFY"
  exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  Restart your dev server for the new token to take effect:${NC}"
echo "   npm run dev"
