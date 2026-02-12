
const { Pool } = require('pg');
const config = require('./config/serverConfig');

const pool = new Pool({
    connectionString: config.database.url,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: {
        rejectUnauthorized: false
    },
    keepAlive: true
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
