BEGIN;

ALTER TABLE rgp_details ADD COLUMN revised_return_date date;

COMMIT;
