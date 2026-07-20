const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件（前端页面）
app.use(express.static(path.join(__dirname, '..', '..', 'web')));
app.use(express.static(path.join(__dirname, '..', '..')));

// API 路由
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/activities', require('./routes/activities.routes'));
app.use('/api/v1/favorites', require('./routes/favorites.routes'));
app.use('/api/v1/notifications', require('./routes/notifications.routes'));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', timestamp: new Date().toISOString() });
});

// 前端 SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'web', 'index.html'));
});

// 错误处理
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`\n🚀 校招瞭望台 后端已启动`);
  console.log(`   API:  http://localhost:${config.PORT}/api/v1`);
  console.log(`   前台: http://localhost:${config.PORT}/\n`);
});
