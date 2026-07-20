const { v4: uuid } = require('uuid');
const prisma = require('../lib/prisma');
const { page: pageResult } = require('../lib/response');

// ==================== 分页查询活动列表 ====================
exports.list = async (filters) => {
  const {
    keyword, regions, years, formats, subTypes,
    statuses, regStatuses, sort, page = 1, pageSize = 12,
  } = filters;

  const where = {};
  const AND = [];

  // 关键词搜索
  if (keyword) {
    AND.push({
      OR: [
        { title: { contains: keyword } },
        { universities: { contains: keyword } },
        { region: { contains: keyword } },
        { location: { contains: keyword } },
        { platform: { contains: keyword } },
      ],
    });
  }

  // 区域筛选：regions字段是JSON数组
  if (regions && regions.length) {
    AND.push({
      OR: regions.map(r => ({ region: { contains: r } })),
    });
  }

  // 届数筛选
  if (years && years.length) {
    AND.push({
      OR: years.map(y => ({ graduateYears: { contains: y } })),
    });
  }

  // 活动形式
  if (formats && formats.length) {
    AND.push({ format: { in: formats.map(mapFormatToDb) } });
  }

  // 细分类型
  if (subTypes && subTypes.length) {
    AND.push({
      OR: subTypes.map(st => ({ activityType: { contains: st } })),
    });
  }

  // 活动状态
  if (statuses && statuses.length) {
    AND.push({ status: { in: statuses.map(mapStatusToDb) } });
  }

  // 报名状态
  if (regStatuses && regStatuses.length) {
    AND.push({ registrationStatus: { in: regStatuses.map(mapRegStatusToDb) } });
  }

  if (AND.length) where.AND = AND;

  // 动态更新状态
  await updateStatuses();

  // 排序
  let orderBy = { createdAt: 'desc' };
  if (sort === 'deadline') orderBy = { registrationDeadline: 'asc' };
  else if (sort === 'date') orderBy = { activityStartDate: 'asc' };

  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const take = parseInt(pageSize);

  const [list, total] = await Promise.all([
    prisma.activity.findMany({ where, orderBy, skip, take }),
    prisma.activity.count({ where }),
  ]);

  return pageResult(list.map(formatActivity), total, parseInt(page), parseInt(pageSize));
};

// ==================== 查询单条活动 ====================
exports.getById = async (id) => {
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) throw Object.assign(new Error('活动不存在'), { status: 404 });
  return formatActivity(activity);
};

// ==================== 创建活动 ====================
exports.create = async (data) => {
  const activity = await prisma.activity.create({
    data: {
      id: uuid(),
      ...data,
      region: ensureJson(data.region),
      universities: ensureJson(data.universities),
      graduateYears: ensureJson(data.graduateYears),
      sourceLinks: ensureJson(data.sourceLinks),
    },
  });
  return formatActivity(activity);
};

// ==================== 更新活动 ====================
exports.update = async (id, data) => {
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('活动不存在'), { status: 404 });

  const updateData = { ...data };
  if (data.region) updateData.region = ensureJson(data.region);
  if (data.universities) updateData.universities = ensureJson(data.universities);
  if (data.graduateYears) updateData.graduateYears = ensureJson(data.graduateYears);
  if (data.sourceLinks) updateData.sourceLinks = ensureJson(data.sourceLinks);

  const activity = await prisma.activity.update({ where: { id }, data: updateData });
  return formatActivity(activity);
};

// ==================== 删除活动 ====================
exports.remove = async (id) => {
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('活动不存在'), { status: 404 });
  await prisma.activity.delete({ where: { id } });
  return { deleted: true };
};

// ==================== 批量更新活动状态 ====================
async function updateStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // 状态自动流转：活动结束日过去 → 已结束
  await prisma.activity.updateMany({
    where: { activityEndDate: { lt: today }, status: { not: 'ended' } },
    data: { status: 'ended' },
  });

  // 活动开始日已到 → 进行中
  await prisma.activity.updateMany({
    where: {
      activityStartDate: { lte: today },
      activityEndDate: { gte: today },
      status: 'preview',
    },
    data: { status: 'ongoing' },
  });

  // 报名截止日期过去 → 已截止
  await prisma.activity.updateMany({
    where: { registrationDeadline: { lt: today }, registrationStatus: 'open' },
    data: { registrationStatus: 'closed' },
  });
}

// ==================== 格式化输出 ====================
function formatActivity(a) {
  return {
    ...a,
    region: safeJson(a.region),
    universities: safeJson(a.universities),
    graduateYears: safeJson(a.graduateYears),
    sourceLinks: safeJson(a.sourceLinks),
    isVerified: Boolean(a.isVerified),
  };
}

function safeJson(v) {
  try { return JSON.parse(v); } catch { return []; }
}

function ensureJson(v) {
  return typeof v === 'string' ? v : JSON.stringify(v || []);
}

function mapFormatToDb(f) {
  if (f === '线上') return 'online';
  if (f === '线下') return 'offline';
  return 'hybrid'; // '其他'
}

function mapStatusToDb(s) {
  if (s === '预告') return 'preview';
  if (s === '进行中') return 'ongoing';
  if (s === '已结束') return 'ended';
  return s;
}

function mapRegStatusToDb(s) {
  if (s === '报名中') return 'open';
  if (s === '已截止') return 'closed';
  return s;
}
