const auth = require('./auth');

module.exports = function admin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ code: 40300, message: '需要管理员权限' });
    }
    next();
  });
};
