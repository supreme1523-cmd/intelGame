
const path = require('path');

const config = {
    port: process.env.PORT || 3000,
    database: {
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        name: process.env.DB_NAME,
        pass: process.env.DB_PASS,
        port: process.env.DB_PORT || 5432
    },
    admin: {
        viewKey: process.env.ADMIN_VIEW_KEY || 'test_key'
    },
    game: {
        turnTimeoutMs: 60000,
        roomCodeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    },
    paths: {
        root: path.join(__dirname, '../../'),
        static: path.join(__dirname, '../../')
    }
};

module.exports = config;
