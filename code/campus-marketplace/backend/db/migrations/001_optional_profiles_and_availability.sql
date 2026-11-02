-- Apply manually after confirming this database uses the users/listings/
-- purchase_requests/borrowings schema referenced by the starter routes.
-- Existing deployments are not modified automatically by the application.

ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN contact_info DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_contact_info_ten_digits'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_contact_info_ten_digits
      CHECK (contact_info IS NULL OR contact_info = '' OR contact_info ~ '^[0-9]{10}$') NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_active_created_idx
  ON listings (created_at DESC) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS borrowings_reserved_period_idx
  ON borrowings (listing_id, start_time, end_time)
  WHERE status IN ('BOOKED', 'ACTIVE');

CREATE INDEX IF NOT EXISTS purchase_requests_pending_listing_idx
  ON purchase_requests (listing_id) WHERE status = 'PENDING';
