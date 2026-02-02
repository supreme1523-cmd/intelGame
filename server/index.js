
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameLogic = require('../js/logic.js'); // Shared Logic

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from root
app.use(express.static(path.join(__dirname, '../')));

// Explicitly serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Game State Management
const matches = {}; // roomId -> { state, p1: socketId, p2: socketId, p1Action: null, p2Action: null, timeout: null }
const users = {}; // socketId -> roomId

const TURN_TIMEOUT_MS = 60000;

function startTurnTimeout(roomId) {
    const match = matches[roomId];
    if (!match) return;

    if (match.timeout) clearTimeout(match.timeout);

    match.timeout = setTimeout(() => {
        console.log(`Match ${roomId}: Turn Timeout Reached.`);
        // Force resolve with idle if actions missing
        if (!match.p1Action) match.p1Action = { type: 'idle' };
        if (!match.p2Action) match.p2Action = { type: 'idle' };
        resolveMatchTurn(roomId);
    }, TURN_TIMEOUT_MS);
}

function resolveMatchTurn(roomId) {
    const match = matches[roomId];
    if (!match || !match.state) return;
    if (match.timeout) clearTimeout(match.timeout);

    console.log(`Match ${roomId}: Resolving Turn ${match.state.turn}`);

    // Resolve
    const newState = GameLogic.resolveTurn(match.state, match.p1Action, match.p2Action);
    match.history.push(JSON.parse(JSON.stringify(match.state)));
    match.state = newState;

    // Reset Actions
    match.p1Action = null;
    match.p2Action = null;

    // Broadcast Reveal
    io.to(roomId).emit('turn_result', { state: newState });

    // Check Win Condition
    const p1 = newState.players.p1;
    const p2 = newState.players.p2;
    let gameOver = false;
    let msg = "";

    if (p1.hp <= 0 && p2.hp <= 0) {
        gameOver = true;
        msg = "DRAW! Both players eliminated.";
    } else if (p1.hp <= 0) {
        gameOver = true;
        msg = "PLAYER 2 WINS! Player 1 eliminated.";
    } else if (p2.hp <= 0) {
        gameOver = true;
        msg = "PLAYER 1 WINS! Player 2 eliminated.";
    }

    if (gameOver) {
        io.to(roomId).emit('game_over', { msg });
        delete matches[roomId]; // Cleanup finished match
    } else {
        startTurnTimeout(roomId); // Start next turn timer
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    let joined = false;
    for (const [id, match] of Object.entries(matches)) {
        if (!match.p2) {
            match.p2 = socket.id;
            users[socket.id] = id;
            socket.join(id);
            joined = true;
            console.log(`Match ${id}: P2 joined (${socket.id})`);

            match.state = GameLogic.createInitialState();
            io.to(match.p1).emit('match_start', { role: 'p1', state: match.state });
            io.to(match.p2).emit('match_start', { role: 'p2', state: match.state });

            startTurnTimeout(id);
            break;
        }
    }

    if (!joined) {
        const roomId = 'room-' + Math.random().toString(36).substr(2, 9);
        matches[roomId] = {
            state: null,
            history: [],
            p1: socket.id,
            p2: null,
            p1Action: null,
            p2Action: null,
            timeout: null
        };
        users[socket.id] = roomId;
        socket.join(roomId);
        socket.emit('waiting', { msg: 'Waiting for opponent...' });
        console.log(`Match ${roomId}: P1 created (${socket.id})`);
    }

    socket.on('submit_action', (rawAction) => {
        const roomId = users[socket.id];
        const match = matches[roomId];
        if (!match || !match.state) return;

        const isP1 = socket.id === match.p1;
        const isP2 = socket.id === match.p2;
        if (!isP1 && !isP2) return;

        // --- VALIDATION & SANITIZATION ---
        const action = { type: 'idle' }; // Default
        const validTypes = ['move', 'attack', 'defend', 'ability', 'idle'];

        if (rawAction && typeof rawAction === 'object') {
            if (validTypes.includes(rawAction.type)) {
                action.type = rawAction.type;

                // Validate Direction
                if (['move', 'attack'].includes(action.type) || (action.type === 'ability' && rawAction.id === 'blink')) {
                    if (GameLogic.DIRECTIONS[rawAction.dir]) {
                        action.dir = rawAction.dir;
                    } else {
                        action.type = 'idle'; // Fallback
                    }
                }

                // Validate Ability
                if (action.type === 'ability') {
                    if (GameLogic.ABILITIES[rawAction.id]) {
                        action.id = rawAction.id;
                    } else {
                        action.type = 'idle';
                    }
                }
            }
        }

        if (isP1) {
            if (match.p1Action) return; // Already committed
            match.p1Action = action;
            socket.emit('action_committed');
            io.to(match.p2).emit('opponent_committed');
        } else {
            if (match.p2Action) return;
            match.p2Action = action;
            socket.emit('action_committed');
            io.to(match.p1).emit('opponent_committed');
        }

        if (match.p1Action && match.p2Action) {
            resolveMatchTurn(roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomId = users[socket.id];
        if (roomId) {
            const match = matches[roomId];
            if (match) {
                if (match.timeout) clearTimeout(match.timeout);
                io.to(roomId).emit('game_over', { msg: 'Opponent disconnected' });
                delete matches[roomId];
            }
            delete users[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
