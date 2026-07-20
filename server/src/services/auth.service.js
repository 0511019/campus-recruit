const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const prisma = require('../lib/prisma');
const { sign } = require('../lib/jwt');
const config = require('../config');

// ==================== 发送验证码（模拟模式） ====================
exports.sendSms = async (phone, type) => {
  // 检查60秒内是否已发送
  const recent = await prisma.smsCode.findFirst({
    where: { phone, type, createdAt: { gte: new Date(Date.now() - 60000) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    throw Object.assign(new Error('60秒内已发送过验证码'), { status: 429 });
  }

  // 生成4位随机码
  const code = String(Math.floor(1000 + Math.random() * 9000));

  await prisma.smsCode.create({
    data: {
      id: uuid(), phone, code, type,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  if (config.SMS_MOCK) {
    console.log(`[SMS模拟] 手机号: ${phone} 验证码: ${code}`);
  }
  // TODO: 接入阿里云短信SDK发送真实短信

  return true;
};

// ==================== 手机号登录/注册（验证码方式） ====================
exports.loginByPhone = async (phone, code) => {
  // 验证验证码
  const smsCode = await prisma.smsCode.findFirst({
    where: { phone, code, type: 'login', used: 0, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!smsCode) {
    throw Object.assign(new Error('验证码错误或已过期'), { status: 400 });
  }

  await prisma.smsCode.update({ where: { id: smsCode.id }, data: { used: 1 } });

  // 查找或创建用户
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: uuid(), phone,
        nickname: '手机用户' + phone.slice(-4),
      },
    });
  }

  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 手机号注册 ====================
exports.registerByPhone = async (phone, code) => {
  const smsCode = await prisma.smsCode.findFirst({
    where: { phone, code, type: 'register', used: 0, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!smsCode) {
    throw Object.assign(new Error('验证码错误或已过期'), { status: 400 });
  }

  await prisma.smsCode.update({ where: { id: smsCode.id }, data: { used: 1 } });

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw Object.assign(new Error('该手机号已注册，请直接登录'), { status: 409 });
  }

  const user = await prisma.user.create({
    data: { id: uuid(), phone, nickname: '手机用户' + phone.slice(-4) },
  });

  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 微信号登录 ====================
exports.loginByWechat = async (wechatId, password) => {
  const user = await prisma.user.findUnique({ where: { wechatId } });
  if (!user) {
    throw Object.assign(new Error('该微信号未注册'), { status: 404 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('密码错误'), { status: 400 });
  }
  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 微信号注册 ====================
exports.registerByWechat = async (wechatId, password, nickname) => {
  const existing = await prisma.user.findUnique({ where: { wechatId } });
  if (existing) {
    throw Object.assign(new Error('该微信号已注册'), { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { id: uuid(), wechatId, passwordHash, nickname },
  });
  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 账号密码登录 ====================
exports.loginByUsername = async (username, password) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw Object.assign(new Error('账号不存在'), { status: 404 });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('密码错误'), { status: 400 });
  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 账号密码注册 ====================
exports.registerByUsername = async (username, password, nickname) => {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw Object.assign(new Error('该账号已存在'), { status: 409 });
  if (password.length < 6) throw Object.assign(new Error('密码至少6位'), { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { id: uuid(), username, passwordHash, nickname: nickname || username },
  });
  const token = sign({ id: user.id, role: user.role });
  return { user: sanitizeUser(user), token };
};

// ==================== 获取当前用户 ====================
exports.getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('用户不存在'), { status: 404 });
  return sanitizeUser(user);
};

// ==================== 工具函数 ====================
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
