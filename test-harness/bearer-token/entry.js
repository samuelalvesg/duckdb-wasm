import * as duckdb from '@duckdb/duckdb-wasm/dist/duckdb-browser.mjs';
window.duckdb = duckdb;
window.start = async (variant, extRepo) => {
  const worker = new Worker(`/dist/duckdb-browser-${variant}.worker.js`);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  await db.instantiate(`/dist/duckdb-${variant}.wasm`, variant === 'threads' ? '/dist/duckdb-browser-threads.pthread.worker.js' : undefined);
  const cfg = { allowUnsignedExtensions: true };
  if (extRepo) cfg.extensionRepository = extRepo;
  await db.open(cfg);
  window.db = db; window.conn = await db.connect();
  return 'ok';
};
window.q = async (sql) => {
  try { const t = await window.conn.query(sql); return { ok: true, rows: t.toArray().map(r => JSON.parse(JSON.stringify(r, (k, v) => typeof v === 'bigint' ? Number(v) : v))) }; }
  catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 400) }; }
};
window.ready = true;
