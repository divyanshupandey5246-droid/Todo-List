exports.requireLogin = (req, res, next) => {
  if (req.session.user) return next();
  req.session.flash = { type: 'error', text: 'Log in to see your tasks.' };
  res.redirect('/login');
};
exports.guestOnly = (req, res, next) => (req.session.user ? res.redirect('/') : next());
