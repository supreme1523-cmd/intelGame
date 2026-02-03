
const { Pool } = require('pg');
const config = require('../config/serverConfig');

let pool = null;
const dbConfig = {};

if (config.database.url) {
    dbConfig.connectionString = config.database.url;
} else if (config.database.host) {
    dbConfig.user = config.database.user;
    dbConfig.host = config.database.host;
    dbConfig.database = config.database.name;
    dbConfig.password = config.database.pass;
    dbConfig.port = config.database.port;
}

if (dbConfig.connectionString || dbConfig.host) {
    pool = new Pool({
        ...dbConfig,
        ssl: { rejectUnauthorized: false }
    });

    // Initialize schema
    const initSql = `
        CREATE TABLE IF NOT EXISTS feedback_forms (
            id SERIAL PRIMARY KEY,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data JSONB NOT NULL
        );
    `;
    pool.query(initSql, (err) => {
        if (err) console.error("Feedback DB Init Error:", err);
        else console.log("Feedback DB Integrated.");
    });
} else {
    console.warn("No DB config found. Feedback system will be unavailable.");
}

module.exports = pool;
