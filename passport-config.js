const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./db');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err);
  }
});

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

      const existing = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);

      if (existing.rows.length > 0) {
        const updated = await pool.query(
          'UPDATE users SET name = $1, avatar_url = $2, email = $3 WHERE google_id = $4 RETURNING *',
          [profile.displayName, avatar, email, profile.id]
        );
        return done(null, updated.rows[0]);
      }

      const inserted = await pool.query(
        'INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [profile.id, email, profile.displayName, avatar]
      );
      done(null, inserted.rows[0]);
    } catch (err) {
      done(err);
    }
  }
));

module.exports = passport;
