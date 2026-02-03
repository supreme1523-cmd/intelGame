
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config/serverConfig');
const feedbackRoutes = require('./feedback/feedbackRoutes');
const socketController = require('./transport/socketController');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(config.paths.static));

// Routes
app.use('/', feedbackRoutes);

// Helper for root
app.get('/', (req, res) => {
    res.sendFile(path.join(config.paths.static, 'index.html'));
});

// Initialize Socket Controller
socketController(io);

// Start Server
const PORT = config.port;
server.listen(PORT, () => {
    console.log(`Arena Refactored: Running on port ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
