
const pool = require('../db');

if (pool) {
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
