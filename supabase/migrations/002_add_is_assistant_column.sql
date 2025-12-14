-- Add is_assistant column to messages table
-- This flag distinguishes between inbound messages (false) and sent/assistant messages (true)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_assistant BOOLEAN DEFAULT FALSE;

-- Create index on is_assistant for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_is_assistant ON messages(is_assistant);

-- Update existing messages to set is_assistant based on sender_name
-- Messages from our sender name are considered assistant messages
UPDATE messages 
SET is_assistant = TRUE 
WHERE sender_name LIKE '%@imsg.tel';

