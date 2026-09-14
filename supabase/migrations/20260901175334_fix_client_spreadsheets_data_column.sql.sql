/*
# Fix client_spreadsheets schema to use single data column

The previous migration created `columns` and `rows` jsonb columns,
but the frontend type and component expect a single `data` jsonb column
holding a 2D string array (array of rows, each row is array of cell values).

1. Changes
- Add `data` jsonb column (default '[]') to client_spreadsheets
- Drop the `columns` and `rows` columns (they were just created, no user data exists)

2. Security
- No policy changes.
*/

ALTER TABLE client_spreadsheets ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE client_spreadsheets DROP COLUMN IF EXISTS columns;
ALTER TABLE client_spreadsheets DROP COLUMN IF EXISTS rows;
