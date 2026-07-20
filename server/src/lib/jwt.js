const jwt = require('jsonwebtoken');
const config = require('../config');

exports.sign = (payload) => jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

exports.verify = (token) => jwt.verify(token, config.JWT_SECRET);
