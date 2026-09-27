const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { ensureAuthenticated, ensureAdmin } = require('./auth-middleware');

// Пользователь отправляет свой результат на проверку
router.post('/', ensureAuthenticated, async (req, res, next) => {
  try {
    const { level_id, video_url, progress } = req.body;
    await pool.query(
      `INSERT INTO submissions (level_id, user_id, video_url, progress) VALUES ($1,$2,$3,$4)`,
      [level_id, req.user.id, video_url, Number(progress) || 100]
    );
    res.redirect(`/levels/${level_id}?submitted=1`);
  } catch (err) {
    next(err);
  }
});

// Админ одобряет результат
router.post('/:id/approve', ensureAdmin, async (req, res, next) => {
  try {
    await pool.query(`UPDATE submissions SET status = 'approved' WHERE id = $1`, [req.params.id]);
    res.redirect('/admin/submissions');
  } catch (err) {
    next(err);
  }
});

// Админ отклоняет результат
router.post('/:id/reject', ensureAdmin, async (req, res, next) => {
  try {
    await pool.query(`UPDATE submissions SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    res.redirect('/admin/submissions');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
