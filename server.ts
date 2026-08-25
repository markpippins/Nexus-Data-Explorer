import express from 'express';
import path from 'path';

import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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

  // DB Workbench backend authority: draft-srv (:3170). The UI server no longer
  // implements /api/db/* itself — it transparently forwards every /api/db/*
  // request to draft-srv, which owns the multi-engine driver registry
  // (postgres live, mysql provisioned-behind-flag). Single mode authority per
  // LAC: if draft-srv is unreachable the workbench fails VISIBLY (502 with the
  // upstream error) — never silently degraded.
  const DB_WORKBENCH_URL = process.env.DB_WORKBENCH_URL || 'http://localhost:3170';

  // Security Pass Alpha (22fe12bc): draft-srv requires the fleet internal
  // secret on every route except /api/health. This server-to-server proxy is
  // exactly the trusted path — inject the header from the unit environment.
  // The secret must never reach the browser; it stays in this process env.
  const dbProxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.NEXUS_INTERNAL_SECRET) {
    dbProxyHeaders['X-Nexus-Internal'] = process.env.NEXUS_INTERNAL_SECRET;
  }

  app.use('/api/db', async (req, res) => {
    const started = Date.now();
    try {
      const upstream = await fetch(`${DB_WORKBENCH_URL}${req.originalUrl}`, {
        method: req.method,
        headers: dbProxyHeaders,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await upstream.text();
      res.status(upstream.status);
      const ctype = upstream.headers.get('content-type');
      if (ctype) res.setHeader('Content-Type', ctype);
      res.send(text);
    } catch (err: any) {
      // Fail-visible: surface the transport failure, never simulate success.
      res.status(502).json({
        success: false,
        error: `DB workbench backend (${DB_WORKBENCH_URL}) unreachable: ${err?.message || err}`,
        hint: 'Is draft-srv running? (nexus/typescript/draft-srv, port 3170)',
        latencyMs: Date.now() - started,
      });
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
