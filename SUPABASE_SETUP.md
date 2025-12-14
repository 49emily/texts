# Supabase Setup Guide

This guide will help you set up Supabase to store and retrieve group chat messages.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A new Supabase project

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in your project details:
   - **Name**: third-wheel (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait for it to initialize

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_...`) - Safe for browser use
   - **Secret key** (starts with `sb_secret_...`) - For server-side operations only

## Step 3: Set Environment Variables

Add these to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
SUPABASE_SECRET_KEY=your_secret_key_here
```

**Important:**

- The `NEXT_PUBLIC_` prefix makes variables available to the browser
- The secret key should **never** be exposed to the browser - it's only used in API routes
- Keep your secret key secure and never commit it to version control

## Step 4: Run Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `supabase/migrations/001_create_messages_table.sql`
4. Paste it into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)

This will create:

- `messages` table to store all group chat messages
- Indexes for fast queries
- Row Level Security policies

## Step 5: Verify Setup

1. Start your dev server:

   ```bash
   npm run dev
   ```

2. Test the webhook (this will save a message):

   ```bash
   node test-webhook.js message_inbound
   ```

3. Check Supabase dashboard → **Table Editor** → `messages` table
   - You should see the test message saved!

## Step 6: Test Message History API

### Get all groups:

```bash
curl http://localhost:3000/api/groups
```

### Get messages for a specific group:

```bash
curl http://localhost:3000/api/groups/59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b/messages
```

### With pagination:

```bash
curl "http://localhost:3000/api/groups/59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b/messages?limit=20&offset=0"
```

## API Endpoints

### GET `/api/groups`

Get a list of all groups that have messages.

**Query Parameters:**

- `limit` (optional, default: 50, max: 100) - Number of groups to return
- `offset` (optional, default: 0) - Pagination offset

**Response:**

```json
{
  "groups": [
    {
      "group_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
      "group_name": "Test Group",
      "last_message_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "has_more": false
  }
}
```

### GET `/api/groups/[group_id]/messages`

Get message history for a specific group.

**Query Parameters:**

- `limit` (optional, default: 50, max: 100) - Number of messages to return
- `offset` (optional, default: 0) - Pagination offset
- `order_by` (optional, default: "created_at") - Field to order by
- `order` (optional, default: "desc") - Sort direction ("asc" or "desc")

**Response:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "message_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
      "webhook_id": "ab5Ae733-cCFc-4025-9987-7279b26bE71b",
      "group_id": "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
      "group_name": "Test Group",
      "sender_name": "your.sender.name@imsg.tel",
      "recipient": "+13231112233",
      "text": "Hello from the group!",
      "message_type": "text",
      "alert_type": "message_inbound",
      "attachments": null,
      "participants": ["+13231112233", "+13233332211"],
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "has_more": false
  }
}
```

## Database Schema

The `messages` table stores:

- `id` - UUID primary key
- `message_id` - Unique LoopMessage message ID
- `webhook_id` - Unique webhook event ID
- `group_id` - iMessage group identifier
- `group_name` - Optional group name
- `sender_name` - Dedicated sender name
- `recipient` - Recipient phone/email
- `text` - Message text content
- `message_type` - Type of message (text, audio, attachments, etc.)
- `alert_type` - Webhook alert type
- `attachments` - JSON array of attachment URLs
- `participants` - Array of group participant phone numbers/emails
- `created_at` - Timestamp when message was received
- `updated_at` - Timestamp when record was last updated

## Security Notes

- **Secret Key Security:**

  - The secret key (`SUPABASE_SECRET_KEY`) is used only in server-side API routes
  - It bypasses Row Level Security (RLS) and has full database access
  - Never expose this key to the browser or commit it to version control
  - The publishable key is safe to use in client-side code when RLS is enabled

- **Row Level Security:**
  - The current RLS policy allows all operations
  - For production, you should implement proper RLS policies based on your security requirements
  - Consider adding authentication to your API endpoints

## Troubleshooting

### "Missing Supabase environment variables" error

- Make sure `.env.local` has:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- Restart your dev server after adding env variables

### Database errors when saving messages

- Check that the migration ran successfully
- Verify the table exists in Supabase dashboard → Table Editor
- Check browser console and server logs for detailed error messages

### Messages not appearing

- Check Supabase dashboard → Table Editor → `messages` table
- Verify webhook is being received (check server logs)
- Check that `group_id` is present in the webhook payload
