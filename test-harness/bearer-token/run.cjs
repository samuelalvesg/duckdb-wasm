// Usage: node run.cjs <variant: base|threads|mvp|eh> [extensionRepositoryUrl]
const puppeteer = require('puppeteer-core');
const PORT = Number(process.env.PORT || 8765), BASE = `http://localhost:${PORT}`;
const variant = process.argv[2] || 'base', extRepo = process.argv[3] || null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true', { timeout: 30000 });
  const out = (label, v) => console.log(label.padEnd(34), JSON.stringify(v).slice(0, 260));
  const q = async (sql) => page.evaluate((s) => window.q(s), sql);
  const hdrs = async () => (await (await fetch(BASE + '/_log')).json()).filter(r => r.method !== 'OPTIONS').map(r => `${r.method} auth=${r.authorization} x-test=${r.xtest}`);
  const reset = () => fetch(BASE + '/_reset');
  out('start', await page.evaluate((v, e) => window.start(v, e), variant, extRepo).catch(e => 'ERRO ' + String(e).slice(0, 200)));
  out('version', await q('SELECT version() AS v'));
  out('external file cache off', await q('SET enable_external_file_cache=false'));
  out('extensions httpfs', await q("SELECT extension_name, loaded, installed FROM duckdb_extensions() WHERE extension_name IN ('httpfs')"));
  await reset(); out('1 read without secret', await q(`SELECT count(*) AS n FROM '${BASE}/data.csv'`)); out('  headers seen by the server', await hdrs());
  out('2 CREATE SECRET http+bearer', await q(`CREATE SECRET s_bearer (TYPE http, BEARER_TOKEN 'tok123', SCOPE '${BASE}/data.csv')`));
  await reset(); out('3 read with secret', await q(`SELECT count(*) AS n FROM '${BASE}/data.csv'`)); out('  headers seen by the server', await hdrs());
  if (process.env.LOAD_HTTPFS) {
    out('4 INSTALL AND LOAD httpfs', await q('INSTALL httpfs')); out('  LOAD httpfs', await q('LOAD httpfs'));
    out('  extensions httpfs', await q("SELECT extension_name, loaded FROM duckdb_extensions() WHERE extension_name='httpfs'"));
    await q('DROP SECRET IF EXISTS s_bearer'); out('5 CREATE SECRET after httpfs', await q(`CREATE SECRET s_bearer2 (TYPE http, BEARER_TOKEN 'tok123', SCOPE '${BASE}/data.csv')`));
    await reset(); out('6 read after httpfs', await q(`SELECT count(*) AS n FROM '${BASE}/data.csv'`)); out('  headers seen by the server', await hdrs());
    out('  which_secret (scope matches?)', await q(`SELECT * FROM which_secret('${BASE}/data.csv', 'http')`));
    await q('DROP SECRET s_bearer2'); // two http secrets with the same scope do not add up: one per request
    out('7 control: secret with EXTRA_HTTP_HEADERS', await q(`CREATE SECRET s_hdr (TYPE http, EXTRA_HTTP_HEADERS MAP {'X-Test': 'controle'}, SCOPE '${BASE}/data.csv')`));
    await reset(); out('8 read with the control secret', await q(`SELECT count(*) AS n FROM '${BASE}/data.csv'`)); out('  headers seen by the server', await hdrs());
  }
  await browser.close();
})().catch(e => { console.error('FALHA:', e); process.exit(1); });
