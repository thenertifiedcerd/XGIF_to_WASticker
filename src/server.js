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

app.post('/api/convert', async (req, res) => {
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
    await fs.mkdir(jobDirectory, { recursive: true });
    const stat = await convertToSticker(url, outputPath);
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
  fs.mkdir(downloadRoot, { recursive: true }).then(() => {
    app.listen(port, () => {
      console.log(`X GIF to WhatsApp sticker converter listening on port ${port}`);
    });
  });
}

module.exports = app;
