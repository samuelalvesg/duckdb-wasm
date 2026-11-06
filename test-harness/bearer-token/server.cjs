// Serves the duckdb-wasm bundle, a test page and a CSV; records every request header on /data.csv.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT || 8765);
const DIST = process.env.DIST || path.join(__dirname, 'node_modules/@duckdb/duckdb-wasm/dist');
const CSV = 'id,name\n1,a\n2,b\n3,c\n';
const ARROW = path.join(__dirname, 'node_modules/apache-arrow');
const log = [];
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*, Authorization, Range');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified');
  if (url.pathname === '/_log') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(log)); }
  if (url.pathname === '/_reset') { log.length = 0; return res.end('ok'); }
  if (url.pathname === '/data.csv') {
    log.push({ method: req.method, authorization: req.headers['authorization'] || null, range: req.headers['range'] || null, xtest: req.headers['x-test'] || null, acrh: req.headers['access-control-request-headers'] || null });
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('content-type', 'text/csv');
    const r = req.headers['range']; let body = Buffer.from(CSV);
    if (r) { const m = /bytes=(\d+)-(\d*)/.exec(r); const s = +m[1], e = m[2] ? +m[2] : body.length - 1; res.statusCode = 206; res.setHeader('Content-Range', `bytes ${s}-${e}/${body.length}`); body = body.subarray(s, e + 1); }
    res.setHeader('Content-Length', body.length);
    return req.method === 'HEAD' ? res.end() : res.end(body);
  }
  const file = url.pathname.startsWith('/ext/') ? path.join(__dirname, url.pathname) : url.pathname === '/bundle.js' ? path.join(__dirname, 'bundle.js') : url.pathname === '/' ? path.join(__dirname, 'page.html') : url.pathname.startsWith('/arrow/') ? path.join(ARROW, url.pathname.slice(7)) : path.join(DIST, url.pathname.replace(/^\/dist\//, ''));
  if (!file.startsWith(__dirname) && !file.startsWith(DIST) && !file.startsWith(ARROW)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, buf) => { if (err) { res.statusCode = 404; return res.end('404 ' + url.pathname); } res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); res.end(buf); });
}).listen(PORT, () => console.log('listening', PORT));
