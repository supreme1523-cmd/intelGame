
const { Pool } = require('pg');
const dns = require('dns');
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
    keepAlive: true, // Help maintain connection through proxies
    // Force IPv4 resolution to prevent ENETUNREACH on Render's IPv6-limited environment
    lookup: (hostname, options, callback) => {
        return dns.lookup(hostname, { family: 4 }, callback);
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
