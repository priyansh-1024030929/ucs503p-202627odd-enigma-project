// =====================================================================
// POSTGRESQL CONNECTION
// =====================================================================
import pg from 'pg'

console.log("My DB URL is:", process.env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})
