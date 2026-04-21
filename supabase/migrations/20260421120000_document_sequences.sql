-- Track sequential document reference numbers per type.
-- Each row holds the last-issued value; the function increments atomically.
CREATE TABLE "DocumentSequence" (
  type       TEXT    PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "DocumentSequence" (type, last_value) VALUES
  ('INV', 0),
  ('SBI', 0),
  ('OBI', 0),
  ('COM', 0),
  ('CN',  0);

-- Returns the next sequential number for the given document type.
-- Uses UPDATE ... RETURNING for an atomic, lock-free increment.
CREATE OR REPLACE FUNCTION next_document_number(doc_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE "DocumentSequence"
  SET    last_value = last_value + 1
  WHERE  type = doc_type
  RETURNING last_value INTO next_val;

  IF next_val IS NULL THEN
    RAISE EXCEPTION 'Unknown document type: %', doc_type;
  END IF;

  RETURN next_val;
END;
$$;
