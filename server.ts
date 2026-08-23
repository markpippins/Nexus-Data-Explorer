import express from 'express';
import path from 'path';

import { Pool } from 'pg';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

interface ConnSpec {
  host?: string;
  port?: number | string;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

// Per-request pool factory: credentials come from the request body (user-entered
// in the UI), never hardcoded. Each request opens its own short-lived connection
// and closes it, so no credentials are retained server-side.
function openPool(conn: ConnSpec): Pool {
  return new Pool({
    host: conn.host || 'localhost',
    port: parseInt(String(conn.port || '5432'), 10),
    database: conn.database || 'postgres',
    user: conn.username || 'postgres',
    password: conn.password || '',
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
}

// Map a pg column type OID to a readable type name for the results grid.
const PG_TYPES: Record<number, string> = {
  16: 'BOOLEAN', 17: 'BYTEA', 20: 'BIGINT', 21: 'SMALLINT', 23: 'INTEGER',
  25: 'TEXT', 700: 'REAL', 701: 'DOUBLE PRECISION', 1042: 'CHAR',
  1043: 'VARCHAR', 1082: 'DATE', 1083: 'TIME', 1114: 'TIMESTAMP',
  1184: 'TIMESTAMPTZ', 1186: 'INTERVAL', 1700: 'NUMERIC', 2950: 'UUID',
  3802: 'JSONB', 114: 'JSON', 26: 'OID', 600: 'POINT', 1140: 'MONEY',
};

// NOTE: __filename/__dirname are intentionally NOT computed here — the esbuild
// CJS bundle (dist/server.cjs) has an empty import.meta, so fileURLToPath would
// crash at startup. The production branch below resolves the dist directory
// from process.cwd() (the systemd WorkingDirectory), so no module-path shim is
// needed.

async function startServer() {
  const app = express();
  // Honor the deployment PORT (systemd unit sets PORT=4212); 3000 is the ad-hoc default.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Data Workbench API', timestamp: new Date().toISOString() });
  });

  // AI SQL Assistant Route
  app.post('/api/ai/sql', async (req, res) => {
    try {
      const { prompt, schemaInfo, task } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured in environment variables. Please set it in AI Studio Secrets.',
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      let systemInstruction = `You are an expert PostgreSQL DBA and SQL Architect assistant in Data Workbench IDE.
Respond concisely and accurately.
When writing SQL, output valid, optimized PostgreSQL queries. Wrap SQL in standard \`\`\`sql blocks.`;

      let userMessage = `Task: ${task || 'generate'}\nUser Prompt: ${prompt}`;
      if (schemaInfo) {
        userMessage += `\nDatabase Schema Context:\n${JSON.stringify(schemaInfo, null, 2)}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemInstruction}\n\n${userMessage}`,
      });

      const replyText = response.text || 'No response generated from AI model.';

      // Extract SQL snippet if present
      const sqlMatch = replyText.match(/```sql([\s\S]*?)```/);
      const extractedSql = sqlMatch ? sqlMatch[1].trim() : null;

      res.json({
        reply: replyText,
        sql: extractedSql,
      });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.status(500).json({ error: err.message || 'Failed to process AI request' });
    }
  });

  // Test Connection endpoint — REAL connection against the supplied credentials.
  app.post('/api/db/test-connection', async (req, res) => {
    const { host, port, database, username, password, ssl } = req.body || {};
    const started = Date.now();
    const pool = openPool({ host, port, database, username, password, ssl });
    try {
      const { rows } = await pool.query('SELECT version() AS version, current_database() AS db');
      res.json({
        success: true,
        message: `Successfully connected to PostgreSQL at ${host || 'localhost'}:${port || '5432'}/${database || 'postgres'}`,
        latencyMs: Date.now() - started,
        version: rows[0]?.version || 'PostgreSQL',
        database: rows[0]?.db || database,
      });
    } catch (err: any) {
      res.status(502).json({
        success: false,
        message: `Connection failed: ${err?.message || 'unable to reach server'}`,
        latencyMs: Date.now() - started,
      });
    } finally {
      await pool.end();
    }
  });

  // Schema discovery — real tables/columns/views/triggers/procedures from
  // information_schema + pg_catalog for the supplied database.
  app.post('/api/db/schemas', async (req, res) => {
    const { host, port, database, username, password, ssl } = req.body || {};
    const pool = openPool({ host, port, database, username, password, ssl });
    try {
      const { rows: tableRows } = await pool.query(`
        SELECT n.nspname AS schema_name,
               c.relname AS table_name,
               c.reltuples::bigint AS row_count,
               obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND n.nspname NOT LIKE 'pg_temp%'
        ORDER BY n.nspname, c.relname`);

      const { rows: columnRows } = await pool.query(`
        SELECT table_schema, table_name, column_name, data_type,
               is_nullable = 'YES' AS is_nullable,
               COALESCE(column_default, '') AS column_default,
               (SELECT true FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name
                  AND kcu.column_name = c.column_name) AS is_pk
        FROM information_schema.columns c
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_temp%'
        ORDER BY table_schema, table_name, ordinal_position`);

      const { rows: viewRows } = await pool.query(`
        SELECT table_schema, table_name, view_definition
        FROM information_schema.views
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_temp%'
        ORDER BY table_schema, table_name`);

      const schemaMap: Record<string, any> = {};
      for (const r of tableRows) {
        if (!schemaMap[r.schema_name]) {
          schemaMap[r.schema_name] = { name: r.schema_name, tables: [], views: [], triggers: [], procedures: [] };
        }
        schemaMap[r.schema_name].tables.push({
          name: r.table_name,
          schema: r.schema_name,
          rowCount: r.row_count || 0,
          columns: [],
          data: [],
          comment: r.comment,
        });
      }
      for (const r of columnRows) {
        const tbl = schemaMap[r.table_schema]?.tables.find((t: any) => t.name === r.table_name);
        if (tbl) {
          tbl.columns.push({
            name: r.column_name,
            type: r.data_type.toUpperCase(),
            isPrimaryKey: r.is_pk === true,
            isNullable: r.is_nullable,
            defaultValue: r.column_default || undefined,
          });
        }
      }
      for (const r of viewRows) {
        if (!schemaMap[r.table_schema]) {
          schemaMap[r.table_schema] = { name: r.table_schema, tables: [], views: [], triggers: [], procedures: [] };
        }
        schemaMap[r.table_schema].views.push({
          name: r.table_name,
          schema: r.table_schema,
          definition: r.view_definition,
        });
      }
      res.json({ schemas: Object.values(schemaMap) });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Schema discovery failed' });
    } finally {
      await pool.end();
    }
  });

  // Real query execution (SELECT / INSERT / UPDATE / DELETE / DDL). Errors are
  // returned to the UI as a visible error result — never simulated rows.
  app.post('/api/db/query', async (req, res) => {
    const { connection, sql } = req.body || {};
    if (!connection || !sql) {
      return res.status(400).json({ error: 'connection and sql are required' });
    }
    const pool = openPool(connection);
    const started = Date.now();
    try {
      const result = await pool.query(String(sql));
      const columns = result.fields?.map((f) => f.name) || [];
      const columnTypes = (result.fields || []).reduce((acc: Record<string, string>, f) => {
        acc[f.name] = PG_TYPES[f.dataTypeID] || `type_${f.dataTypeID}`;
        return acc;
      }, {});
      const rows = (result.rows || []).map((r: any) => {
        const out: Record<string, any> = {};
        for (const k of Object.keys(r)) out[k] = r[k];
        return out;
      });
      res.json({
        columns,
        columnTypes,
        rows,
        rowCount: rows.length,
        affectedRows: result.rowCount ?? null,
        executionTimeMs: Date.now() - started,
        status: 'success',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      res.json({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Date.now() - started,
        status: 'error',
        error: err?.message || 'Query failed',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      await pool.end();
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Data Workbench Server running at http://localhost:${PORT}`);
  });
}

startServer();
