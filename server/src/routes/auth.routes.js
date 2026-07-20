const { Router } = require('express');
const authService = require('../services/auth.service');
const { success, error } = require('../lib/response');
const authMiddleware = require('../middleware/auth');

const router = Router();

// 发送短信验证码
router.post('/send-sms', async (req, res, next) => {
  try {
    const { phone, type } = req.body;
    if (!phone || !/^1\d{10}$/.test(phone)) return res.json(error('请输入正确的手机号'));
    if (!['login', 'register'].includes(type)) return res.json(error('验证码类型无效'));
    await authService.sendSms(phone, type);
    res.json(success(null, '验证码已发送'));
  } catch (e) { next(e); }
});

// 手机号登录
router.post('/login/phone', async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.json(error('请填写手机号和验证码'));
    const result = await authService.loginByPhone(phone, code);
    res.json(success(result, '登录成功'));
  } catch (e) { next(e); }
});

// 微信号登录
router.post('/login/wechat', async (req, res, next) => {
  try {
    const { wechatId, password } = req.body;
    if (!wechatId || !password) return res.json(error('请填写微信号和密码'));
    const result = await authService.loginByWechat(wechatId, password);
    res.json(success(result, '登录成功'));
  } catch (e) { next(e); }
});

// 手机号注册
router.post('/register/phone', async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.json(error('请填写手机号和验证码'));
    const result = await authService.registerByPhone(phone, code);
    res.json(success(result, '注册成功'));
  } catch (e) { next(e); }
});

// 微信号注册
router.post('/register/wechat', async (req, res, next) => {
  try {
    const { wechatId, password, nickname } = req.body;
    if (!wechatId || !password) return res.json(error('请填写微信号和密码'));
    if (password.length < 6) return res.json(error('密码至少6位'));
    const result = await authService.registerByWechat(wechatId, password, nickname || wechatId);
    res.json(success(result, '注册成功'));
  } catch (e) { next(e); }
});

// 账号密码登录
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json(error('请填写账号和密码'));
    const result = await authService.loginByUsername(username, password);
    res.json(success(result, '登录成功'));
  } catch (e) { next(e); }
});

// 账号密码注册
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.json(error('请填写账号和密码'));
    const result = await authService.registerByUsername(username, password, nickname);
    res.json(success(result, '注册成功'));
  } catch (e) { next(e); }
});

// 获取当前用户
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json(success(user));
  } catch (e) { next(e); }
});

module.exports = router;
