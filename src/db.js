
const { Pool } = require('pg');
const config = require('./config/serverConfig');

/**
 * Supabase Connection Pool
 * Centralized PostgreSQL client with pooling and SSL enabled
 */
const pool = new Pool({
    connectionString: config.database.url,
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000, // How long to wait when connecting to a new client
    ssl: {
        rejectUnauthorized: false // Required for Supabase / Cloud Postgres
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;
