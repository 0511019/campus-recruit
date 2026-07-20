const { verify } = require('../lib/jwt');
const { error } = require('../lib/response');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json(error('请先登录', 40100));
  }
  try {
    req.user = verify(header.slice(7));
    next();
  } catch {
    res.status(401).json(error('登录已过期，请重新登录', 40101));
  }
};
