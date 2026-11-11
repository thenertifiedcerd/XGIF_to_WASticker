# XGIF_to_WASticker

Web tool that converts GIFs and short videos from X into WhatsApp animated stickers.

## Requirements

Install `yt-dlp`, `ffmpeg`, and Node.js 18 or newer. Then install the application
dependencies and start the server:

```sh
npm install
npm start
```

Open <http://localhost:3000>, paste a public X post URL, and download the generated
WebP sticker. The converter preserves the source aspect ratio with transparent
512 × 512 padding and rejects outputs that cannot be compressed below 500 KB.

## GitHub Pages

The `public` frontend is deployed automatically to GitHub Pages when changes are
pushed to `main` via `.github/workflows/pages.yml`. GitHub Pages cannot run
Express, yt-dlp, or FFmpeg, so deploy the backend separately and set its public
URL in `public/config.js`:

```js
window.APP_CONFIG = {
  apiBaseUrl: 'https://your-backend.example.com'
};
```

The backend must allow CORS requests from the GitHub Pages origin.
Set `CORS_ORIGIN` to that origin when starting the backend, for example
`https://your-user.github.io`.
