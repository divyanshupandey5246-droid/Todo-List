require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const methodOverride = require('method-override');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (isProd) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride((req) => req.body && req.body._method));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

// CSRF protection, flash messages, and shared template variables
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { code: 403, message: 'Form expired. Go back and try again.' });
  }
  res.locals.csrf = req.session.csrf;
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/reset'));
app.use('/', require('./routes/tasks'));

app.use((req, res) => res.status(404).render('error', { code: 404, message: 'Page not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { code: 500, message: 'Something went wrong on our side.' });
});

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
    require('./utils/mailer').verifySmtp();
    require('./utils/reminders').start();
  })
  .catch((err) => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
