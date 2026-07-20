require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES_IN: '7d',
  SMS_MOCK: !process.env.ALIYUN_ACCESS_KEY_ID,
};
