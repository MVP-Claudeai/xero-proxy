const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Proxy all Xero API requests
app.use('/xero', async (req, res) => {
  const xeroPath = req.path;
  const token = req.headers['authorization'];
  const tenantId = req.headers['xero-tenant-id'];

  if (!token) return res.status(401).json({ error: 'No authorization token' });

  try {
    const url = `https://api.xero.com${xeroPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(tenantId && { 'xero-tenant-id': tenantId })
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy connections endpoint
app.get('/connections', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No authorization token' });

  try {
    const response = await fetch('https://api.xero.com/connections', {
      headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Xero proxy running on port ${PORT}`));
