
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');
const GameLogic = require('../js/logic.js'); // Shared Logic

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Body parser for feedback
app.use(express.json());

// Serving static files
app.use(express.static(path.join(__dirname, '../')));

// Database connection pool
let pool = null;
const dbConfig = {};

if (process.env.DATABASE_URL) {
    dbConfig.connectionString = process.env.DATABASE_URL;
} else if (process.env.DB_HOST) {
    dbConfig.user = process.env.DB_USER;
    dbConfig.host = process.env.DB_HOST;
    dbConfig.database = process.env.DB_NAME;
    dbConfig.password = process.env.DB_PASS;
    dbConfig.port = process.env.DB_PORT || 5432;
}

if (dbConfig.connectionString || dbConfig.host) {
    pool = new Pool({
        ...dbConfig,
        ssl: { rejectUnauthorized: false } // Required for Render/Managed DBs
    });
    console.log(`Database pool initialized using ${dbConfig.connectionString ? 'DATABASE_URL' : 'individual components'}.`);

    // Test connection and initialize schema
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error("CRITICAL: Database connection test failed!");
            if (err.code === 'ENOTFOUND') {
                console.error(`DNS Error: Could not resolve '${err.hostname}'. On Render, ensure your Web Service and Database are in the SAME REGION if using internal hostnames.`);
            } else {
                console.error(err);
            }
        } else {
            console.log("Database connection test successful:", res.rows[0].now);

            // Initialize schema if needed
            const initSql = `
                CREATE TABLE IF NOT EXISTS feedback_forms (
                    id SERIAL PRIMARY KEY,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    data JSONB NOT NULL
                );
            `;
            pool.query(initSql, (err) => {
                if (err) {
                    console.error("Failed to initialize database schema:", err);
                } else {
                    console.log("Database schema synchronized (feedback_forms table ready).");
                }
            });
        }
    });
} else {
    console.warn("No database credentials found (DATABASE_URL or DB_HOST). Feedback system is disabled.");
}

// Feedback Endpoint
app.post('/feedback', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ error: 'Feedback system is currently unavailable (no DB connection).' });
    }

    const { name, email_or_contact, rating, comments } = req.body;

    // Validation
    if (!comments || typeof comments !== 'string' || comments.trim().length === 0) {
        return res.status(400).json({ error: 'Comments are required.' });
    }

    if (comments.length > 2000) {
        return res.status(400).json({ error: 'Comment too long (max 2000 chars).' });
    }

    const feedbackData = {
        name: (name || '').slice(0, 100),
        email_or_contact: (email_or_contact || '').slice(0, 150),
        rating: parseInt(rating) || null,
        comments: comments.slice(0, 2000),
        userAgent: req.headers['user-agent'],
        ip_hash: req.ip // Basic abuse prevention if needed
    };

    try {
        await pool.query(
            'INSERT INTO feedback_forms (data) VALUES ($1)',
            [JSON.stringify(feedbackData)]
        );
        res.status(200).json({ message: 'Feedback submitted successfully! Thank you.' });
    } catch (err) {
        if (err.code === 'ENOTFOUND') {
            console.error('Database DNS Error (ENOTFOUND): Could not resolve hostname. If running locally, ensure you are using the EXTERNAL Database URL, not the internal (dpg-...) one.');
        } else {
            console.error('Database Error:', err);
        }
        res.status(500).json({ error: 'Failed to save feedback. Please try again later.' });
    }
});

// Standalone Feedback Page
app.get('/feedback', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Arena Feedback</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; background: #0a0a0b; color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .panel { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); padding: 2.5rem; border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.1); width: 90%; max-width: 500px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
                h1 { color: #00f3ff; margin-top: 0; letter-spacing: 2px; text-transform: uppercase; }
                label { display: block; margin: 1rem 0 0.4rem; color: #888; font-size: 0.9rem; }
                input, textarea, select { width: 100%; padding: 0.8rem; background: rgba(0,0,0,0.3); border: 1px solid #333; color: #fff; border-radius: 6px; box-sizing: border-box; }
                textarea { height: 120px; resize: vertical; }
                .glow-btn { width: 100%; margin-top: 2rem; padding: 1rem; background: #00f3ff; color: #000; border: none; font-weight: bold; border-radius: 8px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; }
                .glow-btn:hover { background: #fff; box-shadow: 0 0 20px rgba(0, 243, 255, 0.5); }
            </style>
        </head>
        <body>
            <div class="panel">
                <h1>PLAYER FEEDBACK</h1>
                <p>Help us improve the Arena.</p>
                <form id="fb-form">
                    <label>Name (Optional)</label>
                    <input type="text" id="name">
                    <label>Contact (Optional)</label>
                    <input type="text" id="contact">
                    <label>Rating</label>
                    <select id="rating">
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Good</option>
                        <option value="3">3 - Fair</option>
                        <option value="2">2 - Poor</option>
                        <option value="1">1 - Needs Work</option>
                    </select>
                    <label>Comments (Required)</label>
                    <textarea id="comments" required></textarea>
                    <button type="submit" class="glow-btn">Submit Feedback</button>
                    <p style="text-align: center; margin-top: 1.5rem;"><a href="/" style="color: #666; text-decoration: none; font-size: 0.8rem;">← Back to Game</a></p>
                </form>
            </div>
            <script>
                document.getElementById('fb-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        name: document.getElementById('name').value.trim(),
                        email_or_contact: document.getElementById('contact').value.trim(),
                        rating: parseInt(document.getElementById('rating').value),
                        comments: document.getElementById('comments').value.trim()
                    };
                    try {
                        const res = await fetch('/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const result = await res.json();
                        alert(result.message || result.error);
                        if (res.ok) window.location.href = '/';
                    } catch (err) {
                        alert('Error submitting feedback.');
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Admin Feedback Viewer
app.get('/admin/feedback', async (req, res) => {
    const key = req.query.key;
    const adminKey = process.env.ADMIN_VIEW_KEY;

    // Show login form if key is missing or incorrect
    if (!adminKey || key !== adminKey) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admin Login</title>
                <style>
                    body { font-family: sans-serif; background: #0a0a0b; color: #eee; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .panel { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 10px; text-align: center; border: 1px solid #333; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
                    input { padding: 0.8rem; border-radius: 5px; border: 1px solid #444; background: #111; color: #fff; width: 250px; margin-bottom: 1rem; }
                    button { padding: 0.8rem 1.5rem; border: none; background: #00f3ff; color: #000; font-weight: bold; border-radius: 5px; cursor: pointer; width: 100%; transition: 0.3s; }
                    button:hover { background: #fff; box-shadow: 0 0 15px rgba(0, 243, 255, 0.4); }
                </style>
            </head>
            <body>
                <div class="panel">
                    <h1 style="color: #00f3ff; letter-spacing: 2px;">DEVELOPER ACCESS</h1>
                    <p style="color: #888; margin-bottom: 2rem;">Feedback System Administration</p>
                    <form method="GET" action="/admin/feedback">
                        <input type="password" name="key" placeholder="Enter ADMIN_VIEW_KEY" required autofocus>
                        <br>
                        <button type="submit">Unlock</button>
                    </form>
                    ${key ? '<p style="color: #ff4444; margin-top: 1rem;">Invalid Key. Access Denied.</p>' : ''}
                </div>
            </body>
            </html>
        `);
    }

    if (!pool) {
        return res.status(503).send('<h1>Service Unavailable</h1><p>Database not connected.</p>');
    }

    try {
        const result = await pool.query('SELECT submitted_at, data FROM feedback_forms ORDER BY submitted_at DESC');

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Arena Feedback Admin</title>
                <style>
                    body { font-family: sans-serif; background: #0a0a0b; color: #eee; padding: 2rem; }
                    table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: rgba(255,255,255,0.05); }
                    th, td { padding: 1rem; border: 1px solid #333; text-align: left; vertical-align: top; }
                    th { background: rgba(0, 243, 255, 0.1); color: #00f3ff; }
                    tr:hover { background: rgba(255,255,255,0.08); }
                    .rating { font-weight: bold; color: #fbbf24; }
                    .back-link { display: inline-block; margin-bottom: 2rem; color: #00f3ff; text-decoration: none; border-bottom: 1px solid transparent; transition: 0.3s; }
                    .back-link:hover { border-bottom-color: #00f3ff; }
                </style>
            </head>
            <body>
                <a href="/" class="back-link">← Return to Game</a>
                <h1>Arena Feedback Master List</h1>
                <p>Newest first. Protected by key.</p>
                <table>
                    <thead>
                        <tr>
                            <th>Submitted At</th>
                            <th>Player</th>
                            <th>Contact</th>
                            <th>Rating</th>
                            <th>Comments</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        result.rows.forEach(row => {
            const d = row.data;
            html += `
                <tr>
                    <td>${new Date(row.submitted_at).toLocaleString()}</td>
                    <td>${d.name || 'Anonymous'}</td>
                    <td>${d.email_or_contact || '-'}</td>
                    <td class="rating">${d.rating || '-'} / 5</td>
                    <td>${d.comments}</td>
                </tr>
            `;
        });

        html += '</tbody></table></body></html>';
        res.send(html);
    } catch (err) {
        console.error('Admin DB Error:', err);
        res.status(500).send('Database Error fetching feedback.');
    }
});

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
    match.history.push(JSON.parse(JSON.stringify(match.state)));
    const { state: newState, events } = GameLogic.resolveTurn(match.state, match.p1Action, match.p2Action);
    match.state = newState;

    // Reset Actions
    match.p1Action = null;
    match.p2Action = null;

    // Broadcast Reveal
    io.to(roomId).emit('turn_result', { state: newState, events });

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

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', () => {
        const code = generateRoomCode();
        matches[code] = {
            state: null,
            history: [],
            p1: socket.id,
            p2: null,
            p1Action: null,
            p2Action: null,
            timeout: null,
            isPrivate: true
        };
        users[socket.id] = code;
        socket.join(code);
        socket.emit('room_created', { code });
        console.log(`Room Created: ${code} by ${socket.id}`);
    });

    socket.on('join_room', (data) => {
        const code = data.code ? data.code.toUpperCase() : null;
        const match = matches[code];

        if (!match) {
            socket.emit('join_failed', { message: 'ROOM NOT FOUND' });
            return;
        }

        if (match.p2) {
            socket.emit('join_failed', { message: 'ROOM IS FULL' });
            return;
        }

        match.p2 = socket.id;
        users[socket.id] = code;
        socket.join(code);
        console.log(`User ${socket.id} joined Room ${code}`);

        // Start Match
        match.state = GameLogic.createInitialState();
        io.to(match.p1).emit('match_start', { role: 'p1', state: match.state });
        io.to(match.p2).emit('match_start', { role: 'p2', state: match.state });

        startTurnTimeout(code);
    });

    socket.on('cancel_room', () => {
        const roomId = users[socket.id];
        if (roomId && matches[roomId]) {
            if (matches[roomId].p1 === socket.id && !matches[roomId].p2) {
                delete matches[roomId];
                socket.leave(roomId);
                delete users[socket.id];
                console.log(`Room ${roomId} cancelled by creator.`);
            }
        }
    });

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
