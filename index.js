const http = require('http');

const server = http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type': 'text/html;charset=utf8'});
    res.write('<h1>Матусевич Илья Михайлович</h1>');
    res.write('<h1>Группа 478</h1>');
    const p1 = Math.PI.toFixed(14);
    res.write(`<h1>Число пи: ${p1}</h1>`);
});

const PORT = 3000;
server.listen(PORT, ()=>{
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});