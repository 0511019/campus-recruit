const { Router } = require('express');
const notificationsService = require('../services/notifications.service');
const { success } = require('../lib/response');
const auth = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const data = await notificationsService.list(req.user.id, parseInt(req.query.page) || 1);
    res.json(success(data));
  } catch (e) { next(e); }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const data = await notificationsService.unreadCount(req.user.id);
    res.json(success(data));
  } catch (e) { next(e); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    await notificationsService.markRead(req.user.id, req.params.id);
    res.json(success(null, '已标记已读'));
  } catch (e) { next(e); }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await notificationsService.markAllRead(req.user.id);
    res.json(success(null, '全部已读'));
  } catch (e) { next(e); }
});

module.exports = router;
