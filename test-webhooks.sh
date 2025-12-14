#!/bin/bash

# Test script for LoopMessage webhooks using curl
# Usage: ./test-webhooks.sh [group_created|message_inbound]

BASE_URL="${TEST_URL:-http://localhost:3000}"
WEBHOOK_URL="$BASE_URL/api/webhooks/loopmessage"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test webhook: group_created
test_group_created() {
  echo -e "${BLUE}📤 Testing group_created webhook${NC}"
  echo ""
  
  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "User-Agent: LoopServer" \
    -H "Connection: close" \
    -d '{
      "alert_type": "group_created",
      "group": {
        "group_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
        "name": "Test Group",
        "participants": ["+13231112233", "+13233332211", "participant@icloud.com"]
      },
      "recipient": "+13231112233",
      "sender_name": "your.sender.name@imsg.tel",
      "text": "User created the group",
      "message_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
      "webhook_id": "ab5Ae733-cCFc-4025-9987-7279b26bE71b",
      "api_version": "1.0"
    }' \
    -w "\n\n${GREEN}✅ Status: %{http_code}${NC}\n" \
    -s
    
  echo ""
}

# Test webhook: message_inbound
test_message_inbound() {
  echo -e "${BLUE}📤 Testing message_inbound webhook${NC}"
  echo ""
  
  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "User-Agent: LoopServer" \
    -H "Connection: close" \
    -d '{
      "alert_type": "message_inbound",
      "recipient": "+13231112233",
      "text": "Hello from the group!",
      "message_type": "text",
      "message_id": "12345678-1234-1234-1234-123456789abc",
      "webhook_id": "87654321-4321-4321-4321-cba987654321",
      "sender_name": "your.sender.name@imsg.tel",
      "group": {
        "group_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
        "name": "Test Group",
        "participants": ["+13231112233", "+13233332211", "participant@icloud.com"]
      },
      "api_version": "1.0"
    }' \
    -w "\n\n${GREEN}✅ Status: %{http_code}${NC}\n" \
    -s
    
  echo ""
}

# Test webhook: non-group message (should be ignored)
test_non_group() {
  echo -e "${BLUE}📤 Testing non-group message (should be ignored)${NC}"
  echo ""
  
  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "User-Agent: LoopServer" \
    -H "Connection: close" \
    -d '{
      "alert_type": "message_inbound",
      "recipient": "+13231112233",
      "text": "Direct message, no group",
      "message_type": "text",
      "message_id": "99999999-9999-9999-9999-999999999999",
      "webhook_id": "88888888-8888-8888-8888-888888888888",
      "api_version": "1.0"
    }' \
    -w "\n\n${GREEN}✅ Status: %{http_code}${NC}\n" \
    -s
    
  echo ""
}

# Main script
case "$1" in
  group_created)
    test_group_created
    ;;
  message_inbound)
    test_message_inbound
    ;;
  non_group)
    test_non_group
    ;;
  all)
    echo -e "${BLUE}🧪 Running all webhook tests${NC}"
    echo "Target URL: $WEBHOOK_URL"
    echo ""
    echo "================================================"
    test_group_created
    echo "================================================"
    test_message_inbound
    echo "================================================"
    test_non_group
    echo "================================================"
    ;;
  *)
    echo "Usage: $0 [group_created|message_inbound|non_group|all]"
    echo ""
    echo "Available tests:"
    echo "  group_created    - Test group creation (expects 'hi group!!' response)"
    echo "  message_inbound  - Test inbound group message (expects 'hiiii' response)"
    echo "  non_group        - Test non-group message (should be ignored)"
    echo "  all              - Run all tests"
    echo ""
    echo "Examples:"
    echo "  $0 group_created"
    echo "  $0 message_inbound"
    echo "  $0 all"
    echo ""
    echo "To test against a different URL:"
    echo "  TEST_URL=https://yourdomain.com $0 group_created"
    exit 1
    ;;
esac

