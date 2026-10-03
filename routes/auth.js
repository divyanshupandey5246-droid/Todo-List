const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { guestOnly } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.get('/register', guestOnly, (req, res) => res.render('register', { error: null, form: {} }));

router.post('/register', guestOnly, limiter, async (req, res, next) => {
  const { name, email, password } = req.body;
  const form = { name, email };
  try {
    if (!name || !email || !password) return res.render('register', { error: 'Fill in every field.', form });
    if (password.length < 8 || password.length > 72) return res.render('register', { error: 'Password must be 8 to 72 characters.', form });
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.render('register', { error: 'That email already has an account.', form });
    }
    const user = await User.create({ name, email, password });
    sendMail({ to: user.email, subject: 'Welcome to Todo Pro', text: `Hi ${user.name}, your account is ready.` })
      .catch((e) => console.error('Welcome mail failed:', e.message));
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user._id, name: user.name };
      req.session.flash = { type: 'ok', text: `Welcome, ${user.name}.` };
      res.redirect('/');
    });
  } catch (e) { next(e); }
});

router.get('/login', guestOnly, (req, res) => res.render('login', { error: null, form: {} }));

router.post('/login', guestOnly, limiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await user.verify(password || ''))) {
      return res.render('login', { error: 'Email or password is wrong.', form: { email } });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user._id, name: user.name };
      res.redirect('/');
    });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
