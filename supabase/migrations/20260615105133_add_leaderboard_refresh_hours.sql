DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='branding' AND column_name='leaderboard_refresh_hours'
  ) THEN 
    ALTER TABLE branding ADD COLUMN leaderboard_refresh_hours INTEGER DEFAULT 24 NOT NULL;
  END IF;
END $$;
