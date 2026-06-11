// 极简 Node.js 静态文件服务器
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.yaml': 'text/plain; charset=utf-8',
    '.csv': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    // 防止目录遍历
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

    // 先检查文件是否存在，避免先 writeHead(200) 再 404 导致 ERR_HTTP_HEADERS_SENT 崩溃
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Not found');
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            // 仅在响应头未发送时改写状态码（极少数 stat 后文件被删除的场景）
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
        stream.pipe(res);
    });
}).listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
});
