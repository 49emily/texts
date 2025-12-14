# Webhook Testing Guide

This guide helps you test the LoopMessage webhook endpoints locally before deploying.

## Prerequisites

1. Make sure your Next.js dev server is running:

   ```bash
   npm run dev
   ```

2. Your server should be running on `http://localhost:3000` (or set `TEST_URL` to your URL)

## Option 1: Using Node.js Script (Recommended)

### Test group creation webhook:

```bash
node test-webhook.js group_created
```

**Expected behavior:**

- Your endpoint receives the webhook
- Logs "Group created: 59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b"
- Attempts to send "hi group!!" message (will fail without real API keys)

### Test inbound message webhook:

```bash
node test-webhook.js message_inbound
```

**Expected behavior:**

- Your endpoint receives the webhook
- Logs "Inbound message in group: 59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b"
- Attempts to send "hiiii" message (will fail without real API keys)

### Test against a deployed URL:

```bash
TEST_URL=https://yourdomain.com node test-webhook.js group_created
```

## Option 2: Using Shell Script (curl)

### Make the script executable (first time only):

```bash
chmod +x test-webhooks.sh
```

### Run individual tests:

```bash
./test-webhooks.sh group_created      # Test group creation
./test-webhooks.sh message_inbound    # Test inbound message
./test-webhooks.sh non_group          # Test non-group message (should be ignored)
```

### Run all tests at once:

```bash
./test-webhooks.sh all
```

### Test against a deployed URL:

```bash
TEST_URL=https://yourdomain.com ./test-webhooks.sh all
```

## What to Look For

### ✅ Successful Response (200)

```json
{
  "success": true
}
```

### ❌ Error Response (200 with error details)

```json
{
  "success": false,
  "error": "Failed to send message: ..."
}
```

## Checking Logs

While testing, watch your Next.js console output for:

```
Received webhook: group_created ab5Ae733-cCFc-4025-9987-7279b26bE71b
Webhook: { alert_type: 'group_created', group: { ... } }
Group created: 59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b
```

## Testing With Real API Keys

If you want to test actual message sending:

1. Add your real LoopMessage credentials to `.env.local`:

   ```bash
   LOOPMESSAGE_AUTH_KEY=your_real_key
   LOOPMESSAGE_SECRET_KEY=your_real_secret
   LOOPMESSAGE_SENDER_NAME=your.sender.name@imsg.tel
   ```

2. Restart your dev server to load the new env vars

3. Run the test webhooks - they will now actually send messages!

⚠️ **Warning:** This will send real messages through the LoopMessage API and may count against your usage limits.

## Testing Without Real API Keys

Without real API keys, you'll see errors like:

```
Failed to send message: ...
```

This is expected! The webhook still works correctly - it just can't actually send the message. The important thing is that your endpoint:

- Returns 200 status
- Processes the webhook correctly
- Attempts to send the appropriate message

## Troubleshooting

### "Connection refused" error

- Make sure your Next.js dev server is running on port 3000
- Or set `TEST_URL` to the correct URL

### "404 Not Found"

- Check that the API route file exists at: `src/app/api/webhooks/loopmessage/route.ts`
- Make sure you're using Next.js 13+ with App Router

### Webhook receives but doesn't send messages

- Check that your environment variables are set correctly
- Look at the console logs for detailed error messages
- Verify your LoopMessage credentials are valid
