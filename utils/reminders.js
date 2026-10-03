const cron = require('node-cron');
const Task = require('../models/Task');
const { sendMail } = require('./mailer');

async function run() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + 2); // overdue, today, tomorrow

  const tasks = await Task.find({ done: false, dueDate: { $ne: null, $lt: limit } })
    .populate('user', 'name email').lean();

  const byUser = new Map();
  for (const t of tasks) {
    if (!t.user) continue;
    const k = String(t.user._id);
    if (!byUser.has(k)) byUser.set(k, { user: t.user, tasks: [] });
    byUser.get(k).tasks.push(t);
  }

  for (const { user, tasks: list } of byUser.values()) {
    const lines = list.sort((a, b) => a.dueDate - b.dueDate)
      .map((t) => `- ${t.title} (${t.dueDate < today ? 'overdue' : 'due'} ${t.dueDate.toISOString().slice(0, 10)})`);
    await sendMail({
      to: user.email,
      subject: `${list.length} task(s) need attention`,
      text: `Hi ${user.name},\n\n${lines.join('\n')}\n`,
    }).catch((e) => console.error('Reminder failed for', user.email, e.message));
  }
}

exports.run = run;
exports.start = () => cron.schedule('0 8 * * *', () => run().catch(console.error), { timezone: 'Asia/Kolkata' });
