# Google Drive streaming proxy

This Node server resolves the Google Drive `export=download` flow, follows the confirmation token if Google presents a warning page, and streams the final video response back to the caller. Use it when the app still references Drive IDs but you want a single fast endpoint that does not have to wait for Drive redirects.

## Run it

1. `cd backend-drive-proxy`
2. `npm install`
3. `npm run start`
4. The server listens on `http://localhost:4000` unless you override `PORT`.

## How it works

Request `GET /stream?id=<drive-file-id>` and the proxy will:

1. Hit `https://drive.google.com/uc?export=download&id=<id>`.
2. If the response comes back as HTML (Drive's consent page), parse the `confirm` token and reissue the request with that token and any returned cookies.
3. Stream the video payload back to the caller while preserving the original `Content-Type`, `Content-Length`, and `Accept-Ranges` headers where possible.

You can host this proxy wherever it can reach Google Drive and expose that URL to the app.

## App integration

Add `DRIVE_PROXY_BASE_URL` to `local.properties` (or another build-time config) with the public URL of this proxy. For example:

```
DRIVE_PROXY_BASE_URL=https://proxy.example.com/stream
```

The Android app will append `?id=<driveFileId>` automatically when it normalizes `drive_link` entries, so the player only ever talks to this single endpoint instead of directly to Drive's download flow.
