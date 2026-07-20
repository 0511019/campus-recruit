const { v4: uuid } = require('uuid');
const prisma = require('../lib/prisma');

exports.list = async (userId, page = 1, pageSize = 12) => {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      include: { activity: true },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
    }),
    prisma.favorite.count({ where: { userId } }),
  ]);
  return {
    list: items.map(i => ({ id: i.id, activityId: i.activityId, createdAt: i.createdAt, activity: i.activity })),
    total, page, pageSize, totalPages: Math.ceil(total / pageSize),
  };
};

exports.add = async (userId, activityId) => {
  const existing = await prisma.favorite.findUnique({
    where: { userId_activityId: { userId, activityId } },
  });
  if (existing) return existing;
  return prisma.favorite.create({ data: { id: uuid(), userId, activityId } });
};

exports.remove = async (userId, activityId) => {
  await prisma.favorite.deleteMany({ where: { userId, activityId } });
  return { deleted: true };
};

exports.check = async (userId, activityId) => {
  const item = await prisma.favorite.findUnique({
    where: { userId_activityId: { userId, activityId } },
  });
  return { favorited: !!item };
};

exports.checkMany = async (userId, activityIds) => {
  const items = await prisma.favorite.findMany({
    where: { userId, activityId: { in: activityIds } },
    select: { activityId: true },
  });
  return new Set(items.map(i => i.activityId));
};

exports.getUserFavoriteIds = async (userId) => {
  const items = await prisma.favorite.findMany({
    where: { userId },
    select: { activityId: true },
  });
  return new Set(items.map(i => i.activityId));
};
