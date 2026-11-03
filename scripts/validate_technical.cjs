/* Run with isolated dependencies described in docs/VALIDATION.md.
 * Uses actual PostgreSQL WASM, Auth stubs and PostGIS; does not connect to Supabase.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, '.tools/validation/package.json'));

async function main() {
  const SwaggerParser = req('@apidevtools/swagger-parser');
  const { parse } = req('pgsql-parser');
  const sql = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
  const ast = await parse(sql);
  console.log(`PASS: PostgreSQL parser accepted ${ast.stmts.length} statements`);
  const spec = await SwaggerParser.validate(path.join(root, 'api/openapi.json'), {
    resolve: { external: false }
  });
  console.log(`PASS: OpenAPI ${spec.openapi} validates (${Object.keys(spec.paths).length} paths)`);

  // Auth shims provide identity only; they do not reproduce hosted Supabase.
  const { PGlite } = req('@electric-sql/pglite');
  const { pgcrypto } = req('@electric-sql/pglite/contrib/pgcrypto');
  const postgisModule = req('@electric-sql/pglite-postgis');
  const postgis = postgisModule.postgis;
  if (!postgis) throw new Error('Expected a named postgis extension export');
  const db = new PGlite({ extensions: { pgcrypto, postgis } });
  try {
    await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
    await db.exec(sql);
    const { rows } = await db.query("SELECT count(*)::integer AS tables FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'");
    console.log(`PASS: fresh schema applied with actual PostGIS (${rows[0].tables} application tables)`);
    await require('./verify_schema.cjs')(db);
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; });
