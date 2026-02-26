import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({
  path: path.resolve(process.cwd(), 'config/.env')
});
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL || 'NOT SET',
    CACHE_SIZE: process.env.CACHE_SIZE || 'NOT SET',
    PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || 'NOT SET',
    MAX_CART_ITEMS: process.env.MAX_CART_ITEMS || 'NOT SET',
    SESSION_TIMEOUT: process.env.SESSION_TIMEOUT || 'NOT SET',
    // Secret values
    DB_USERNAME: process.env.DB_USERNAME || 'NOT SET',
    DB_PASSWORD: process.env.DB_PASSWORD || 'NOT SET',
  };

  res.send(`
    <html>
      <head><style>
        body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 2rem; }
        h1 { color: #00d4ff; }
        pre { background: #16213e; padding: 1rem; border-radius: 8px; font-size: 1rem; }
        .label { color: #f39c12; }
        .value { color: #2ecc71; }
      </style></head>
      <body>
        <h1>🚀 K8s Demo App</h1>
        <h2>Environment Variables (from ConfigMap + Secrets)</h2>
        <pre>${JSON.stringify(envVars, null, 2)}</pre>
      </body>
    </html>
  `);
  // console.log('Current working directory:', process.cwd());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`✅ App listening at http://localhost:${port}`);
});