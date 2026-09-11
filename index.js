const http = require('http');
const EventEmitter = require('events');
const logger = require('./logger');
class AppServer extends EventEmitter {
  start(port) {
    this.server = http.createServer((req, res) => {
      this.emit('request:received', { url: req.url, method: req.method });

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.write('Матусевич Илья Михайлович');
      res.write('Группа 478');
      res.write('Hello from Event-Driven Server!');
    });

    this.server.listen(port, () => {
      this.emit('server:started', port);
    });
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        this.emit('server:stopped');
      });
    }
  }
}

const app = new AppServer();

app.on('server:started', (port) => {
  console.log(`  Сервер запущен на порту ${port}`);
});

app.on('request:received', (reqInfo) => {
  console.log(`  Получен запрос: ${reqInfo.method} ${reqInfo.url}`);
});

app.on('server:stopped', () => {
  console.log('  Сервер остановлен');
});

logger.setupLogger(app);
app.start(3000);

setTimeout(() => {
  app.stop();
}, 10000);