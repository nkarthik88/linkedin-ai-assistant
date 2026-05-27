CREATE TABLE IF NOT EXISTS waitlist_emails (
  email      text PRIMARY KEY,
  signed_up_at timestamptz DEFAULT now() NOT NULL
);
