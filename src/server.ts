import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app  = express();
const PORT = parseInt(process.env.PORT || '4001');
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET  || 'dev_webhook_secret';

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// REPLACE with:
app.get('/widget-config', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ apiUrl: '' }); // empty — widget now calls /widget-proxy/* instead
});

// ADD these proxy routes after the existing routes:

app.get('/widget-proxy/conversations/by-channel/:channelConversationId', async (req, res) => {
  try {
    const r = await fetch(
      `${BACKEND_API_URL}/webhooks/conversations/by-channel/${encodeURIComponent(req.params.channelConversationId)}`,
      { headers: { 'x-webhook-secret': WEBHOOK_SECRET } }
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, message: 'Proxy error' });
  }
});

app.get('/widget-proxy/conversations/:conversationId/widget-messages', async (req, res) => {
  try {
    const r = await fetch(
      `${BACKEND_API_URL}/webhooks/conversations/${req.params.conversationId}/widget-messages`,
      { headers: { 'x-webhook-secret': WEBHOOK_SECRET } }
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, message: 'Proxy error' });
  }
});

app.post('/widget-proxy/conversations/:conversationId/seen', async (req, res) => {
  try {
    const r = await fetch(
      `${BACKEND_API_URL}/webhooks/conversations/${req.params.conversationId}/seen`,
      { method: 'POST', headers: { 'x-webhook-secret': WEBHOOK_SECRET } }
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, message: 'Proxy error' });
  }
});

app.post('/widget-proxy/inbound', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_API_URL}/webhooks/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, message: 'Proxy error' });
  }
});

app.post('/widget-proxy/upload', async (req, res) => {
  try {
    // Forward multipart as-is using pipe
    const headers: Record<string, string> = {
      'x-webhook-secret': WEBHOOK_SECRET,
    };
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }
    const response = await fetch(`${BACKEND_API_URL}/upload/widget`, {
      method: 'POST',
      headers,
      // @ts-ignore — node-fetch/native fetch both accept a ReadableStream/Buffer
      body: req,
      duplex: 'half',
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, message: 'Upload proxy error' });
  }
});

app.get('/widget-proxy/channel-status', async (req, res) => {
  try {
    const storeId = req.query.storeId as string;
    const r = await fetch(
      `${BACKEND_API_URL}/channel-status/webstore/public?storeId=${encodeURIComponent(storeId || '')}`
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false });
  }
});

app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

app.get('/widget-ui', (req, res) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.sendFile(path.join(__dirname, '../public/widget-ui.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test.html'));
});

const wsProxy = createProxyMiddleware({
  target: BACKEND_API_URL,
  changeOrigin: true,
  ws: true,
});

app.use('/ws', wsProxy);

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade!(req, socket as any, head);
});

server.listen(PORT, () => {
  console.log(`Widget server running on http://localhost:${PORT}`);
});