-- Run once against the marketplace database after the core marketplace schema.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS reviews (
  review_id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  borrowing_id INTEGER REFERENCES borrowings(borrowing_id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_exactly_one_deal CHECK (
    (transaction_id IS NOT NULL AND borrowing_id IS NULL) OR
    (transaction_id IS NULL AND borrowing_id IS NOT NULL)
  ),
  CONSTRAINT reviews_cannot_review_self CHECK (reviewer_id <> reviewee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_transaction_reviewer_unique
  ON reviews (transaction_id, reviewer_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_borrowing_reviewer_unique
  ON reviews (borrowing_id, reviewer_id) WHERE borrowing_id IS NOT NULL;
