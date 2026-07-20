const { Router } = require('express');
const activitiesService = require('../services/activities.service');
const { success } = require('../lib/response');
const adminMiddleware = require('../middleware/admin');

const router = Router();

// 分页查询（公开）
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      keyword: req.query.keyword,
      regions: req.query.regions ? req.query.regions.split(',').filter(Boolean) : [],
      years: req.query.years ? req.query.years.split(',').filter(Boolean) : [],
      formats: req.query.formats ? req.query.formats.split(',').filter(Boolean) : [],
      subTypes: req.query.subTypes ? req.query.subTypes.split(',').filter(Boolean) : [],
      statuses: req.query.statuses ? req.query.statuses.split(',').filter(Boolean) : [],
      regStatuses: req.query.regStatuses ? req.query.regStatuses.split(',').filter(Boolean) : [],
      sort: req.query.sort || 'deadline',
      page: parseInt(req.query.page) || 1,
      pageSize: Math.min(parseInt(req.query.pageSize) || 12, 100),
    };
    const data = await activitiesService.list(filters);
    res.json(success(data));
  } catch (e) { next(e); }
});

// 单条查询（公开）
router.get('/:id', async (req, res, next) => {
  try {
    const activity = await activitiesService.getById(req.params.id);
    res.json(success(activity));
  } catch (e) { next(e); }
});

// 创建（管理员）
router.post('/', adminMiddleware, async (req, res, next) => {
  try {
    const activity = await activitiesService.create(req.body);
    res.json(success(activity, '活动创建成功'));
  } catch (e) { next(e); }
});

// 更新（管理员）
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const activity = await activitiesService.update(req.params.id, req.body);
    res.json(success(activity, '活动更新成功'));
  } catch (e) { next(e); }
});

// 删除（管理员）
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    await activitiesService.remove(req.params.id);
    res.json(success(null, '活动已删除'));
  } catch (e) { next(e); }
});

module.exports = router;
