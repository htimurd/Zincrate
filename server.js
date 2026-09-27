require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const passport = require('./passport-config');

const { pool, initDb } = require('./db');
const { ensureAdmin } = require('./auth-middleware');

const authRoutes = require('./auth-routes');
const levelRoutes = require('./levels-routes');
const submissionRoutes = require('./submissions-routes');

const PgSession = pgSessionFactory(session);
const app = express();

// Все .ejs файлы лежат прямо в корне проекта — без папки views/.
app.set('view engine', 'ejs');
app.set('views', __dirname);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Единственный статический файл — стили. Отдаём его отдельным
// маршрутом, чтобы не открывать всю папку проекта как статику
// (там же лежат server.js, .env и остальной код).
app.get('/style.css', (req, res) => {
  res.type('text/css');
  res.sendFile(path.join(__dirname, 'style.css'));
});

// Сессии хранятся в той же Postgres-базе, что и остальные данные —
// это переживает рестарты и редеплои сервиса на Render.
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'zincrate-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAdmin = !!(req.user && req.user.email === process.env.ADMIN_EMAIL);
  next();
});

app.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM levels ORDER BY position ASC, id ASC');
    res.render('view-index', { levels: result.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT users.id, users.name, COUNT(submissions.id) AS completions
      FROM submissions
      JOIN users ON submissions.user_id = users.id
      WHERE submissions.status = 'approved'
      GROUP BY users.id, users.name
      ORDER BY completions DESC, users.name ASC
    `);
    res.render('view-leaderboard', { players: result.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/admin', ensureAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM levels ORDER BY position ASC, id ASC');
    res.render('view-admin', { levels: result.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/admin/submissions', ensureAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT submissions.*, users.name AS user_name, levels.name AS level_name
      FROM submissions
      JOIN users ON submissions.user_id = users.id
      JOIN levels ON submissions.level_id = levels.id
      ORDER BY (submissions.status = 'pending') DESC, submissions.created_at DESC
    `);
    res.render('view-admin-submissions', { submissions: result.rows });
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRoutes);
app.use('/levels', levelRoutes);
app.use('/submissions', submissionRoutes);

app.use((req, res) => {
  res.status(404).render('view-404');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Что-то сломалось на сервере. Попробуйте позже.');
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Zincrate запущен на порту ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Не удалось подключиться к базе данных:', err);
    process.exit(1);
  });
