const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { sendOtp, sendMail } = require('../utils/mailer');
const { guestOnly } = require('../middleware/auth');

const OTP_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const mask = (e) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c);

router.get('/forgot', guestOnly, (req, res) => res.render('forgot', { error: null }));

router.post('/forgot', guestOnly, limiter, async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.render('forgot', { error: 'Enter your email address.' });

    // Cooldown lives in the session, so it behaves the same whether or not the account exists
    if (req.session.resetSentAt && Date.now() - req.session.resetSentAt < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - req.session.resetSentAt)) / 1000);
      req.session.flash = { type: 'error', text: `Wait ${wait}s before asking for another code.` };
      return res.redirect('/reset');
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10); // always hash, so response time doesn't reveal the account
    const user = await User.findOne({ email });
    if (user) {
      await PasswordReset.findOneAndUpdate(
        { email },
        { otpHash, attempts: 0, expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000) },
        { upsert: true, new: true }
      );
      try { await sendOtp(email, otp, OTP_MINUTES); }
      catch (e) { console.error('OTP email failed:', e.message); } // keep response identical for every email
    }

    req.session.resetEmail = email;
    req.session.resetSentAt = Date.now();
    req.session.flash = { type: 'ok', text: 'If that email has an account, a 6-digit code is on its way.' };
    res.redirect('/reset');
  } catch (e) { next(e); }
});

router.get('/reset', guestOnly, (req, res) => {
  if (!req.session.resetEmail) return res.redirect('/forgot');
  res.render('reset', { error: null, email: mask(req.session.resetEmail), minutes: OTP_MINUTES });
});

router.post('/reset', guestOnly, limiter, async (req, res, next) => {
  try {
    const email = req.session.resetEmail;
    if (!email) return res.redirect('/forgot');
    const view = (error) => res.render('reset', { error, email: mask(email), minutes: OTP_MINUTES });

    const otp = (req.body.otp || '').trim();
    const { password = '', confirm = '' } = req.body;
    if (!/^\d{6}$/.test(otp)) return view('Enter the 6-digit code from your email.');
    if (password.length < 8 || password.length > 72) return view('Password must be 8 to 72 characters.');
    if (password !== confirm) return view('The two passwords do not match.');

    const bad = 'That code is wrong or has expired. Request a new one if needed.';
    const rec = await PasswordReset.findOne({ email });
    if (!rec || rec.expiresAt < new Date()) return view(bad);
    if (rec.attempts >= MAX_ATTEMPTS) { await rec.deleteOne(); return view(bad); }

    if (!(await bcrypt.compare(otp, rec.otpHash))) {
      rec.attempts += 1;
      await rec.save();
      return view(bad);
    }

    const user = await User.findOne({ email });
    if (!user) return view(bad);
    user.password = password; // hashed by the model's pre-save hook
    await user.save();
    await rec.deleteOne();
    sendMail({ to: user.email, subject: 'Your password was changed', text: "Your Todo Pro password was just changed. If this wasn't you, reset it again straight away." })
      .catch((e) => console.error('Notice mail failed:', e.message));

    // Log the user out everywhere
    try {
      await mongoose.connection.collection('sessions').deleteMany({ session: { $regex: `"id":"${user._id}"` } });
    } catch (_) { /* non-fatal */ }

    delete req.session.resetEmail;
    delete req.session.resetSentAt;
    req.session.flash = { type: 'ok', text: 'Password updated. Log in with your new password.' };
    res.redirect('/login');
  } catch (e) { next(e); }
});

module.exports = router;
