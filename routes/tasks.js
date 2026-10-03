const router = require('express').Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const RANK = { high: 0, medium: 1, low: 2 };
const clean = (b) => ({
  title: (b.title || '').trim(),
  notes: (b.notes || '').trim(),
  priority: ['low', 'medium', 'high'].includes(b.priority) ? b.priority : 'medium',
  category: (b.category || '').trim(),
  dueDate: b.dueDate ? new Date(b.dueDate) : null,
});
const owned = (req) => mongoose.isValidObjectId(req.params.id)
  ? Task.findOne({ _id: req.params.id, user: req.session.user.id }) : Promise.resolve(null);

router.get('/', async (req, res, next) => {
  try {
    const uid = req.session.user.id;
    const { status = 'all', priority = '', category = '', q = '', sort = 'smart' } = req.query;
    const filter = { user: uid };
    if (status === 'open') filter.done = false;
    if (status === 'done') filter.done = true;
    if (['low', 'medium', 'high'].includes(priority)) filter.priority = priority;
    if (category) filter.category = category;
    if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const [tasks, all, categories] = await Promise.all([
      Task.find(filter).lean(),
      Task.find({ user: uid }, 'done dueDate').lean(),
      Task.distinct('category', { user: uid, category: { $ne: '' } }),
    ]);

    const far = new Date('2999-01-01');
    const by = {
      newest: (a, b) => b.createdAt - a.createdAt,
      due: (a, b) => (a.dueDate || far) - (b.dueDate || far),
      priority: (a, b) => RANK[a.priority] - RANK[b.priority],
      smart: (a, b) => a.done - b.done || (a.dueDate || far) - (b.dueDate || far) || RANK[a.priority] - RANK[b.priority],
    };
    tasks.sort(by[sort] || by.smart);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const stats = {
      total: all.length,
      done: all.filter((t) => t.done).length,
      overdue: all.filter((t) => !t.done && t.dueDate && t.dueDate < today).length,
    };
    res.render('tasks', { tasks, stats, categories, filters: { status, priority, category, q, sort }, today });
  } catch (e) { next(e); }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const data = clean(req.body);
    if (!data.title) req.session.flash = { type: 'error', text: 'Give the task a title.' };
    else await Task.create({ ...data, user: req.session.user.id });
    res.redirect('/');
  } catch (e) { next(e); }
});

router.get('/tasks/:id/edit', async (req, res, next) => {
  try {
    const task = await owned(req);
    if (!task) return res.status(404).render('error', { code: 404, message: 'Task not found.' });
    res.render('edit', { task });
  } catch (e) { next(e); }
});

router.put('/tasks/:id', async (req, res, next) => {
  try {
    const task = await owned(req);
    if (!task) return res.status(404).render('error', { code: 404, message: 'Task not found.' });
    const data = clean(req.body);
    if (!data.title) { req.session.flash = { type: 'error', text: 'Title cannot be empty.' }; return res.redirect(`/tasks/${task._id}/edit`); }
    Object.assign(task, data);
    await task.save();
    req.session.flash = { type: 'ok', text: 'Task saved.' };
    res.redirect('/');
  } catch (e) { next(e); }
});

router.patch('/tasks/:id/toggle', async (req, res, next) => {
  try {
    const task = await owned(req);
    if (task) { task.done = !task.done; await task.save(); }
    res.redirect(req.get('Referer') || '/');
  } catch (e) { next(e); }
});

router.delete('/tasks/completed', async (req, res, next) => {
  try {
    const r = await Task.deleteMany({ user: req.session.user.id, done: true });
    req.session.flash = { type: 'ok', text: `Cleared ${r.deletedCount} completed task(s).` };
    res.redirect('/');
  } catch (e) { next(e); }
});

router.delete('/tasks/:id', async (req, res, next) => {
  try {
    if (mongoose.isValidObjectId(req.params.id)) {
      await Task.deleteOne({ _id: req.params.id, user: req.session.user.id });
      req.session.flash = { type: 'ok', text: 'Task deleted.' };
    }
    res.redirect('/');
  } catch (e) { next(e); }
});

module.exports = router;
