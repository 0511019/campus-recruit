module.exports = function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    code: 50000,
    message: err.message || '服务器内部错误',
  });
};
