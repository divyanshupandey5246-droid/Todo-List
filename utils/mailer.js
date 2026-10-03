const nodemailer = require('nodemailer');

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendMail({ to, subject, text }) {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    return console.log(`\n[DEV MAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
  }
  await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

// Called once at startup so a wrong password shows up immediately in the console
async function verifySmtp() {
  if (!transporter) return console.log('SMTP not configured: emails/OTPs will print in this console (dev only).');
  try {
    await transporter.verify();
    console.log(`SMTP ready: sending as ${process.env.SMTP_USER}`);
  } catch (e) {
    console.error('SMTP check FAILED:', e.message, '\n -> Check SMTP_USER / SMTP_PASS (Gmail needs an App Password).');
  }
}

exports.sendMail = sendMail;
exports.verifySmtp = verifySmtp;
exports.sendOtp = (to, otp, minutes) => sendMail({
  to,
  subject: 'Your Todo Pro password reset code',
  text: `Your password reset code is ${otp}.\n\nIt expires in ${minutes} minutes. If you didn't request this, ignore this email; your password has not changed.`,
});
