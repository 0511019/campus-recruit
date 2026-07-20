const prisma = require('../lib/prisma');

exports.list = async (userId, page = 1, pageSize = 20) => {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return {
    list: items, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
  };
};

exports.unreadCount = async (userId) => {
  const count = await prisma.notification.count({
    where: { userId, isRead: 0 },
  });
  return { count };
};

exports.markRead = async (userId, id) => {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: 1 },
  });
  return { read: true };
};

exports.markAllRead = async (userId) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: 0 },
    data: { isRead: 1 },
  });
  return { readAll: true };
};
