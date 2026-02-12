
const { Pool } = require('pg');
const config = require('./config/serverConfig');

/**
 * Supabase Connection Pool
 * Centralized PostgreSQL client with pooling and SSL enabled
 */
const pool = new Pool({
    connectionString: config.database.url,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000, // Increased to 10s for slower cold starts
    ssl: {
        rejectUnauthorized: false
    },
    keepAlive: true // Help maintain connection through proxies
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
