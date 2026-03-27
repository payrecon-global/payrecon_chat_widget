import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

const app  = express();
const PORT = parseInt(process.env.PORT || '4001');
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET  || 'dev_webhook_secret';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/widget-config', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({
    apiUrl:   BACKEND_API_URL,
    whSecret: WEBHOOK_SECRET,
  });
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

app.listen(PORT, () => {
  console.log(`Widget server running on http://localhost:${PORT}`);
});