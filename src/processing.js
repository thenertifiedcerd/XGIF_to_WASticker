const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const STICKER_SIZE = 512;
const MAX_FILE_BYTES = 500 * 1024;
const MAX_PROCESSING_MS = 120_000;

function isSupportedXUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'x.com' ||
        url.hostname === 'www.x.com' ||
        url.hostname === 'twitter.com' ||
        url.hostname === 'www.twitter.com') &&
      /^\/[^/]+\/status\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out`));
    }, MAX_PROCESSING_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed: ${stderr.slice(-1000)}`));
      }
    });
  });
}

async function convertToSticker(url, outputPath) {
  const directory = path.dirname(outputPath);
  const inputPath = path.join(directory, 'source.%(ext)s');
  const ytDlpArgs = [
    '--no-playlist',
    '--no-part',
    '--max-filesize',
    '50M',
    '-f',
    'bestvideo[ext=mp4]/best[ext=mp4]/best',
    '-o',
    inputPath,
    url
  ];
  if (process.env.YTDLP_COOKIES_FILE) {
    ytDlpArgs.splice(0, 0, '--cookies', process.env.YTDLP_COOKIES_FILE);
  }
  await run('yt-dlp', ytDlpArgs);

  const entries = await fs.readdir(directory);
  const source = entries.find((entry) => entry.startsWith('source.'));
  if (!source) {
    throw new Error('yt-dlp did not produce a video file');
  }

  const sourcePath = path.join(directory, source);
  const attempts = [
    { fps: 15, quality: 55, duration: 10 },
    { fps: 12, quality: 48, duration: 10 },
    { fps: 10, quality: 42, duration: 8 },
    { fps: 8, quality: 35, duration: 6 }
  ];

  for (const attempt of attempts) {
    await run('ffmpeg', [
      '-y',
      '-i',
      sourcePath,
      '-t',
      String(attempt.duration),
      '-vf',
      `fps=${attempt.fps},scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease,pad=${STICKER_SIZE}:${STICKER_SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p`,
      '-c:v',
      'libwebp',
      '-lossless',
      '0',
      '-q:v',
      String(attempt.quality),
      '-loop',
      '0',
      '-an',
      outputPath
    ]);
    const stat = await fs.stat(outputPath);
    if (stat.size < MAX_FILE_BYTES) {
      return stat;
    }
  }

  throw new Error('The video could not be compressed below WhatsApp’s 500 KB limit');
}

module.exports = {
  MAX_FILE_BYTES,
  STICKER_SIZE,
  convertToSticker,
  isSupportedXUrl
};
