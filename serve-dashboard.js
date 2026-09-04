const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // Add CORS headers so Playwright report fetch requests succeed locally
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqUrl = decodeURIComponent(req.url.split('?')[0]);
  if (reqUrl === '/') {
    reqUrl = '/index.html';
  }

  const filePath = path.normalize(path.join(ROOT_DIR, reqUrl));

  // Security check to prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Fallback for playwright-test-report.html if playwright-report/index.html is requested but missing
      if (reqUrl.includes('playwright-report/index.html')) {
        const fallbackPath = path.join(ROOT_DIR, 'playwright-test-report.html');
        if (fs.existsSync(fallbackPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(fallbackPath).pipe(res);
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`File not found: ${reqUrl}`);
      return;
    }

    if (stats.isDirectory()) {
      const indexInDir = path.join(filePath, 'index.html');
      if (fs.existsSync(indexInDir)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexInDir).pipe(res);
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n=============================================================`);
  console.log(`🚀 Local Regression Dashboard Server is live!`);
  console.log(`📌 Access Dashboard at: ${url}`);
  console.log(`Press Ctrl+C to stop the server.`);
  console.log(`=============================================================\n`);

  // Auto-open browser
  const startCmd = process.platform === 'win32'
    ? `start ${url}`
    : process.platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`;

  exec(startCmd, (err) => {
    if (err) {
      console.log(`Note: Open ${url} manually in your web browser.`);
    }
  });
});
