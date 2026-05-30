-- Add guest_cap to events table
-- Valid values: 5, 10, 25, 50, 100, 150, 200, null (unlimited)
ALTER TABLE events ADD COLUMN guest_cap INTEGER;
