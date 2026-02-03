
const express = require('express');
const router = express.Router();
const pool = require('./database');
const config = require('../config/serverConfig');

// GET /feedback - Standalone Feedback Page
router.get('/feedback', (req, res) => {
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

// POST /feedback - Submit Feedback
router.post('/feedback', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'DB Unavailable' });

    const { name, email_or_contact, rating, comments } = req.body;
    if (!comments?.trim()) return res.status(400).json({ error: 'Comments required' });

    const feedbackData = {
        name: (name || '').slice(0, 100),
        email_or_contact: (email_or_contact || '').slice(0, 150),
        rating: parseInt(rating) || null,
        comments: comments.slice(0, 2000),
        userAgent: req.headers['user-agent'],
        ip_hash: req.ip
    };

    try {
        await pool.query('INSERT INTO feedback_forms (data) VALUES ($1)', [JSON.stringify(feedbackData)]);
        res.status(200).json({ message: 'Feedback submitted! Thank you.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /admin/feedback - Admin Preview
router.get('/admin/feedback', async (req, res) => {
    const key = req.query.key;
    const adminKey = config.admin.viewKey;

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
                    ${key ? '<p style="color: #ff4444; margin-top: 1rem;">Invalid Key.</p>' : ''}
                </div>
            </body>
            </html>
        `);
    }

    try {
        const result = await pool.query('SELECT submitted_at, data FROM feedback_forms ORDER BY submitted_at DESC');
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Feedback Admin</title>
                <style>
                    body { font-family: sans-serif; background: #0a0a0b; color: #eee; padding: 2rem; }
                    table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: rgba(255,255,255,0.05); }
                    th, td { padding: 1rem; border: 1px solid #333; text-align: left; }
                </style>
            </head>
            <body>
                <h1>Arena Feedback Master List</h1>
                <table>
                    <thead><tr><th>Time</th><th>Player</th><th>Rating</th><th>Comments</th></tr></thead>
                    <tbody>
        `;
        result.rows.forEach(row => {
            html += `<tr><td>${new Date(row.submitted_at).toLocaleString()}</td><td>${row.data.name || 'Anon'}</td><td>${row.data.rating}/5</td><td>${row.data.comments}</td></tr>`;
        });
        html += '</tbody></table></body></html>';
        res.send(html);
    } catch (err) {
        res.status(500).send('DB Error');
    }
});

module.exports = router;
