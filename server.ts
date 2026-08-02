import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '4212', 10);

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

  // Test Connection endpoint
  app.post('/api/db/test-connection', (req, res) => {
    const { host, port, database, username } = req.body;
    // Simulate ping / latency
    const pingMs = Math.floor(Math.random() * 25) + 12;
    res.json({
      success: true,
      message: `Successfully connected to PostgreSQL at ${host}:${port}/${database}`,
      latencyMs: pingMs,
      version: 'PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc',
    });
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
