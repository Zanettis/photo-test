CREATE TABLE event_participants (
  event_id  UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participant_select" ON event_participants
  FOR SELECT USING (user_id = auth.uid());

-- Permite que participantes vejam eventos em que foram registrados
CREATE POLICY "participant_view_events" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM event_participants WHERE user_id = auth.uid())
  );
