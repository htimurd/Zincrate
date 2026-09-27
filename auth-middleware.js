function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/google');
}

function ensureAdmin(req, res, next) {
  const isAdmin = req.isAuthenticated &&
    req.isAuthenticated() &&
    req.user &&
    req.user.email === process.env.ADMIN_EMAIL;

  if (isAdmin) {
    return next();
  }
  res.status(403).render('view-403');
}

module.exports = { ensureAuthenticated, ensureAdmin };
