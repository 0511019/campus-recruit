exports.success = (data, message = 'ok') => ({ code: 0, data, message });

exports.error = (message, code = 40000) => ({ code, message });

exports.page = (list, total, page, pageSize) => ({
  list, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
});
