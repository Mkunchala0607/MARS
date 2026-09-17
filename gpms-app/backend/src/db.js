import pg from 'pg'
import { config } from './config.js'

// Return NUMERIC as JS numbers (values here are money/weights well within double precision)
// and DATE as plain 'YYYY-MM-DD' strings so no timezone shifting happens.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)))
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)))
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: config.dbPoolMax })

export const query = (text, params) => pool.query(text, params)

export async function one(text, params) {
  const { rows } = await pool.query(text, params)
  return rows[0] || null
}

/** Run fn inside a transaction. fn receives a client with the same query API. */
export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Allocate the next document number, e.g. NRGP-2026-0001. Row-locked so concurrent requests never collide. */
export async function nextDocumentNo(client, prefix, date = new Date()) {
  const year = date.getFullYear()
  const { rows } = await client.query(
    `INSERT INTO document_sequences (prefix, year, last_no) VALUES ($1, $2, 1)
     ON CONFLICT (prefix, year) DO UPDATE SET last_no = document_sequences.last_no + 1
     RETURNING last_no`,
    [prefix, year],
  )
  return `${prefix}-${year}-${String(rows[0].last_no).padStart(4, '0')}`
}
