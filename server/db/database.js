const { Pool } = require('pg');
const pg = require('pg');

// Parse bigint (COUNT(*) returns int8) as JS number
pg.types.setTypeParser(20, parseInt);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepare(sql) {
  const pgSql = convertPlaceholders(sql);
  return {
    get: (...params) => pool.query(pgSql, params.length ? params : undefined).then(r => r.rows[0] ?? null),
    all: (...params) => pool.query(pgSql, params.length ? params : undefined).then(r => r.rows),
    run: (...params) => pool.query(pgSql, params.length ? params : undefined),
  };
}

async function exec(sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { prepare, exec, withTransaction, pool };
