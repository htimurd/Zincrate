const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { ensureAdmin } = require('./auth-middleware');

// Публичная страница уровня
router.get('/:id', async (req, res, next) => {
  try {
    const levelResult = await pool.query('SELECT * FROM levels WHERE id = $1', [req.params.id]);
    if (levelResult.rows.length === 0) {
      return res.status(404).render('view-404');
    }

    const recordsResult = await pool.query(
      `SELECT submissions.*, users.name AS user_name
       FROM submissions
       JOIN users ON submissions.user_id = users.id
       WHERE submissions.level_id = $1 AND submissions.status = 'approved'
       ORDER BY submissions.progress DESC, submissions.created_at ASC`,
      [req.params.id]
    );

    res.render('view-level', {
      level: levelResult.rows[0],
      records: recordsResult.rows,
      submitted: req.query.submitted === '1'
    });
  } catch (err) {
    next(err);
  }
});

// Страница редактирования (админ)
router.get('/:id/edit', ensureAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM levels WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).render('view-404');
    }
    res.render('view-admin-edit', { level: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Добавить уровень в список (админ)
router.post('/', ensureAdmin, async (req, res, next) => {
  try {
    const { name, author, level_id, difficulty, stars, image_url, verifier, video_url, description, position } = req.body;
    await pool.query(
      `INSERT INTO levels (name, author, level_id, difficulty, stars, image_url, verifier, video_url, description, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [name, author, level_id || null, difficulty, stars ? Number(stars) : null, image_url || null, verifier || null, video_url || null, description || null, Number(position) || 0]
    );
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

// Изменить уровень (админ)
router.post('/:id/edit', ensureAdmin, async (req, res, next) => {
  try {
    const { name, author, level_id, difficulty, stars, image_url, verifier, video_url, description, position } = req.body;
    await pool.query(
      `UPDATE levels SET name=$1, author=$2, level_id=$3, difficulty=$4, stars=$5,
       image_url=$6, verifier=$7, video_url=$8, description=$9, position=$10
       WHERE id=$11`,
      [name, author, level_id || null, difficulty, stars ? Number(stars) : null, image_url || null, verifier || null, video_url || null, description || null, Number(position) || 0, req.params.id]
    );
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

// Удалить уровень (админ)
router.post('/:id/delete', ensureAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM levels WHERE id = $1', [req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
