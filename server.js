const fs = require('fs');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '3000', 10);
const LOG_DIR = '/app/logs';
const LOG_FILE = path.join(LOG_DIR, 'access.log');
const VALID_COLUMNS = ['todo', 'doing', 'done'];

fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10
});

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const entry = {
            ts: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            ms: Date.now() - start
        };
        logStream.write(JSON.stringify(entry) + '\n');
    });
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true });
    } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
    }
});

app.get('/api/cards', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, title, description, column_name, created_at, updated_at FROM cards ORDER BY created_at ASC'
    );
    const grouped = { todo: [], doing: [], done: [] };
    for (const row of rows) grouped[row.column_name].push(row);
    res.json(grouped);
});

app.post('/api/cards', async (req, res) => {
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await pool.query(
        `INSERT INTO cards (title, description, column_name) VALUES ($1, $2, 'todo')
         RETURNING id, title, description, column_name, created_at, updated_at`,
        [title, description]
    );
    res.status(201).json(rows[0]);
});

app.patch('/api/cards/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const column_name = req.body.column_name;
    if (!VALID_COLUMNS.includes(column_name)) {
        return res.status(400).json({ error: 'column_name must be todo|doing|done' });
    }
    const { rows } = await pool.query(
        `UPDATE cards SET column_name = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, title, description, column_name, created_at, updated_at`,
        [column_name, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
});

app.delete('/api/cards/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query('DELETE FROM cards WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
});

app.get('/api/stats', async (req, res) => {
    const { rows } = await pool.query(`
        SELECT
            (SELECT COUNT(*)::int FROM cards) AS total,
            (SELECT COUNT(*)::int FROM cards WHERE created_at >= date_trunc('day', NOW())) AS today
    `);
    res.json(rows[0]);
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, () => {
    console.log(`TaskBoard listening on :${PORT}`);
});
