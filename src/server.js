const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const {
  MAX_FILE_BYTES,
  convertToSticker,
  isSupportedXUrl
} = require('./processing');

const app = express();
const port = Number(process.env.PORT || 3000);
const downloadRoot = path.join(os.tmpdir(), 'xgif-to-wasticker-downloads');
const corsOrigin = process.env.CORS_ORIGIN || '';
const conversionConcurrency = Math.min(
  2,
  Math.max(1, Number(process.env.CONVERSION_CONCURRENCY || 1))
);
const maxQueueLength = 4;
const rateLimitWindowMs = 60_000;
const rateLimitMax = 10;
const outputTtlMs = 30 * 60_000;
const rateLimits = new Map();
const conversionQueue = [];
let activeConversions = 0;

app.use((req, res, next) => {
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString()
    .split(',')[0]
    .trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > rateLimitMax;
}

async function removeExpiredDownloads() {
  await fs.mkdir(downloadRoot, { recursive: true });
  const entries = await fs.readdir(downloadRoot, { withFileTypes: true });
  const cutoff = Date.now() - outputTtlMs;
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const directory = path.join(downloadRoot, entry.name);
    const stat = await fs.stat(directory);
    if (stat.mtimeMs < cutoff) {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }));
}

function processQueue() {
  while (activeConversions < conversionConcurrency && conversionQueue.length > 0) {
    const job = conversionQueue.shift();
    activeConversions += 1;
    job()
      .finally(() => {
        activeConversions -= 1;
        processQueue();
      })
      .catch(() => {});
  }
}

function enqueueConversion(job) {
  if (conversionQueue.length >= maxQueueLength) {
    return Promise.reject(new Error('The converter is busy. Please try again shortly.'));
  }
  return new Promise((resolve, reject) => {
    conversionQueue.push(() => job().then(resolve, reject));
    processQueue();
  });
}

app.post('/api/convert', async (req, res) => {
  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many conversion requests. Try again later.' });
  }
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!isSupportedXUrl(url)) {
    return res.status(400).json({
      error: 'Enter a valid public X post URL, such as https://x.com/user/status/123.'
    });
  }

  const id = crypto.randomUUID();
  const jobDirectory = path.join(downloadRoot, id);
  const outputPath = path.join(jobDirectory, 'sticker.webp');

  try {
    const stat = await enqueueConversion(async () => {
      await fs.mkdir(jobDirectory, { recursive: true });
      return convertToSticker(url, outputPath);
    });
    res.json({
      downloadUrl: `/downloads/${id}/sticker.webp`,
      size: stat.size,
      maxSize: MAX_FILE_BYTES
    });
  } catch (error) {
    await fs.rm(jobDirectory, { recursive: true, force: true });
    console.error(error);
    res.status(422).json({
      error: error.message || 'The post could not be converted.'
    });
  }
});

app.use('/downloads', express.static(downloadRoot, {
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-sticker.webp"');
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }
}));

if (require.main === module) {
  fs.mkdir(downloadRoot, { recursive: true }).then(removeExpiredDownloads).then(() => {
    setInterval(() => {
      removeExpiredDownloads().catch((error) => console.error('Download cleanup failed:', error));
    }, 5 * 60_000).unref();
    app.listen(port, () => {
      console.log(`X GIF to WhatsApp sticker converter listening on port ${port}`);
    });
  });
}

module.exports = app;
