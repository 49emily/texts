-- Create messages table to store group chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  webhook_id TEXT UNIQUE NOT NULL,
  group_id TEXT NOT NULL,
  group_name TEXT,
  sender_name TEXT NOT NULL,
  recipient TEXT,
  text TEXT,
  message_type TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  attachments JSONB,
  participants TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on group_id for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);

-- Create index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Create index on message_id for lookups
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
-- For server-side operations, you might want to use service_role key instead
CREATE POLICY "Allow all operations" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

