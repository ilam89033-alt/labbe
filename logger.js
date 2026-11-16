const fs = require('fs');

function writeLog(eventName, data) {
  const time = new Date().toISOString();
  const line = `[${time}] ${eventName}: ${data}\n`;

  fs.appendFile('logs.txt', line, (err) => {
    if (err) console.error('Ошибка записи в лог:', err);
  });
}

function setupLogger(app) {
  app.on('server:started', (port) => writeLog('server:started', port));
  app.on('request:received', (reqInfo) => writeLog('request:received', `${reqInfo.method} ${reqInfo.url}`));
  app.on('server:stopped', () => writeLog('server:stopped', 'сервер остановлен'));
}

module.exports = { setupLogger };