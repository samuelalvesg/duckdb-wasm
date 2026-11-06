# bearer_token in DuckDB-Wasm: browser check

Checks, in a real Chrome, whether a `bearer_token` secret reaches the server as `Authorization: Bearer <token>`
when DuckDB-Wasm reads a file over HTTP with the loadable httpfs extension.

A small server logs the request headers it receives. A headless Chrome (puppeteer-core) runs `run.cjs`:

1. read the file without a secret;
2. `INSTALL`/`LOAD httpfs` from a local extension repository;
3. `CREATE SECRET (TYPE http, BEARER_TOKEN 'tok123', SCOPE '<file url>')` and read the file;
4. control: drop that secret, create one with `EXTRA_HTTP_HEADERS MAP {'X-Test': 'control'}` and read again.
   If `X-Test` arrives, secrets are being applied, so a missing `Authorization` is not a setup problem.

## Run

```
npm install
npm run build                      # bundles entry.js into bundle.js
npm run serve &                    # http://localhost:8765, logs headers of /data.csv
# extension repository layout: ext/<arm>/<platform>/v2.0.0/<platform>/httpfs.duckdb_extension.wasm
LOAD_HTTPFS=1 npm test -- base http://localhost:8765/ext/<arm>/wasm_eh
```

`CHROME_PATH` sets the Chrome binary (default `/usr/bin/google-chrome`). The `base` bundle asks for the `wasm_eh`
platform. The extension files come from the `main-extensions-wasm_eh` artifact of the Main Extension Distribution
Pipeline run of a duckdb-httpfs build (download it with `gh run download <run> -n main-extensions-wasm_eh -D ext/<arm>/wasm_eh`).

## Result (2026-11-06)

`@duckdb/duckdb-wasm@1.33.1-dev114.0` (DuckDB v2.0.0), Chrome 157, bundle `base`. Extensions built by the CI of
a fork of duckdb-httpfs.

| httpfs build | `Authorization` seen by the server | control `X-Test` |
|---|---|---|
| `main` of duckdb/duckdb-httpfs (`3b48554`) | `null` | `control` |
| `main` + `bearer_token` sent from `HTTPRequestSnapshot::CreateRequest` | `Bearer tok123` (HEAD and GET) | `control` |

The extension published in the official repository was older than this DuckDB-Wasm build and dropped even the
`EXTRA_HTTP_HEADERS` control, so it cannot be used for this check.
