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

## Azure Container Apps backend

The backend includes a Docker image and a Bicep deployment for Azure Container
Apps. Container Apps is configured with exactly one replica because generated
stickers are temporarily stored on the container's local disk. It uses 1 vCPU,
1 GiB RAM, and processes one conversion at a time; the in-memory queue accepts
up to four waiting jobs. Outputs are removed after 30 minutes.

Build and publish the image to a registry, then deploy it with:

```sh
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/main.bicep \
  --parameters \
    environmentId=<container-app-environment-resource-id> \
    image=<registry>/<image>:<tag> \
    corsOrigin=https://<user>.github.io
```

The Docker image installs the latest yt-dlp release during each build. Rebuild
regularly because X changes frequently and datacenter IPs may be rate-limited.
For posts requiring authentication, mount a cookies file and set
`YTDLP_COOKIES_FILE` to its path. Keep that file private and do not commit it.
The downloader rejects inputs over 50 MB. The API also limits each client IP to
10 conversion requests per minute.
