require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const passport = require('./config/passport');

const { pool, initDb } = require('./db/db');
const { ensureAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const levelRoutes = require('./routes/levels');
const submissionRoutes = require('./routes/submissions');

const PgSession = pgSessionFactory(session);
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    res.render('index', { levels: result.rows });
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
    res.render('leaderboard', { players: result.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/admin', ensureAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM levels ORDER BY position ASC, id ASC');
    res.render('admin', { levels: result.rows });
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
    res.render('admin_submissions', { submissions: result.rows });
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRoutes);
app.use('/levels', levelRoutes);
app.use('/submissions', submissionRoutes);

app.use((req, res) => {
  res.status(404).render('404');
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
