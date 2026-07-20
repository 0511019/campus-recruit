const { Router } = require('express');
const favoritesService = require('../services/favorites.service');
const { success } = require('../lib/response');
const auth = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const data = await favoritesService.list(req.user.id, parseInt(req.query.page) || 1);
    res.json(success(data));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    await favoritesService.add(req.user.id, req.body.activityId);
    res.json(success(null, '已收藏'));
  } catch (e) { next(e); }
});

router.delete('/:activityId', async (req, res, next) => {
  try {
    await favoritesService.remove(req.user.id, req.params.activityId);
    res.json(success(null, '已取消收藏'));
  } catch (e) { next(e); }
});

router.get('/check/:activityId', async (req, res, next) => {
  try {
    const result = await favoritesService.check(req.user.id, req.params.activityId);
    res.json(success(result));
  } catch (e) { next(e); }
});

module.exports = router;
