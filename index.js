const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Keep-alive ping every 14 minutes so Render free tier never sleeps
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  fetch(`${RENDER_URL}/health`)
    .then(() => console.log('Keep-alive ping OK'))
    .catch(e => console.log('Keep-alive failed:', e.message));
}, 14 * 60 * 1000);

// Proxy /connections endpoint
app.get('/connections', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No authorization token' });
  try {
    const r = await fetch('https://api.xero.com/connections', {
      headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy all /xero/* to Xero API
app.all('/xero/*', async (req, res) => {
  const token = req.headers['authorization'];
  const tenantId = req.headers['xero-tenant-id'];
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  const xeroPath = req.path.replace('/xero', '');
  const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
  const url = `https://api.xero.com${xeroPath}${qs}`;
  console.log(`→ ${req.method} ${url}`);

  try {
    const r = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(tenantId ? { 'xero-tenant-id': tenantId } : {})
      },
      ...(req.method !== 'GET' && req.body ? { body: JSON.stringify(req.body) } : {})
    });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(r.status).json(await r.json());
    } else {
      const buf = await r.buffer();
      res.status(r.status).set('Content-Type', ct).send(buf);
    }
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Proxy running on ${PORT}`));
