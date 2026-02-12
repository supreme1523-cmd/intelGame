
const path = require('path');

const config = {
    port: process.env.PORT || 3000,
    database: {
        url: process.env.DATABASE_URL
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
