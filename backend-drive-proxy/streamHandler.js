const https = require("https");
const { URL } = require("url");

const DRIVE_EXPORT_BASE = "https://drive.google.com/uc?export=download";
const CONFIRM_TOKEN_PATTERN = /confirm=([0-9A-Za-z_-]+)/;
const HTML_CONTENT_TYPE = "text/html";

async function handleStreamRequest(req, res) {
  try {
    if (req.method !== "GET") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Only GET requests are supported.");
      return;
    }
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const fileId = parsedUrl.searchParams.get("id") ?? parsedUrl.searchParams.get("fileId");
    if (!fileId) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing google drive file id (use query parameter id=<fileId>).");
      return;
    }
    await streamDriveFile(fileId, res);
  } catch (error) {
    sendError(res, 500, error.message);
  }
}

async function streamDriveFile(fileId, clientRes) {
  const initialResponse = await fetchDriveResponse(fileId);
  if (isConfirmPage(initialResponse)) {
    const body = await collectStream(initialResponse);
    const confirmToken = extractConfirmToken(body);
    if (!confirmToken) {
      throw new Error("Unable to find Drive confirmation token.");
    }
    const cookieHeader = buildCookieHeader(initialResponse.headers["set-cookie"]);
    const finalResponse = await fetchDriveResponse(fileId, confirmToken, cookieHeader);
    forwardResponse(finalResponse, clientRes);
  } else {
    forwardResponse(initialResponse, clientRes);
  }
}

function fetchDriveResponse(fileId, confirmToken, cookieHeader) {
  return new Promise((resolve, reject) => {
    const driveUrl = new URL(DRIVE_EXPORT_BASE);
    driveUrl.searchParams.set("id", fileId);
    if (confirmToken) {
      driveUrl.searchParams.set("confirm", confirmToken);
    }
    const headers = {};
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    const request = https.get(driveUrl, { headers, timeout: 20000 }, response => {
      resolve(response);
    });
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error("Drive request timed out."));
    });
  });
}

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

function isConfirmPage(response) {
  const contentType = response.headers["content-type"] || "";
  return contentType.startsWith(HTML_CONTENT_TYPE);
}

function extractConfirmToken(body) {
  const match = CONFIRM_TOKEN_PATTERN.exec(body);
  return match ? match[1] : null;
}

function buildCookieHeader(cookies) {
  if (!cookies || !Array.isArray(cookies)) {
    return "";
  }
  return cookies.map(cookie => cookie.split(";")[0]).join("; ");
}

function forwardResponse(source, destination) {
  const headers = {};
  if (source.headers["content-type"]) {
    headers["Content-Type"] = source.headers["content-type"];
  }
  if (source.headers["content-length"]) {
    headers["Content-Length"] = source.headers["content-length"];
  }
  if (source.headers["accept-ranges"]) {
    headers["Accept-Ranges"] = source.headers["accept-ranges"];
  }
  destination.writeHead(source.statusCode || 200, headers);
  source.pipe(destination);
  source.on("error", err => {
    console.error("Streaming error:", err.message);
    if (!destination.headersSent) {
      destination.writeHead(502, { "Content-Type": "text/plain" });
    }
    destination.end();
  });
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(`Error: ${message}`);
}

module.exports = {
  handleStreamRequest,
  streamDriveFile,
  fetchDriveResponse,
  collectStream,
  isConfirmPage,
  extractConfirmToken,
  buildCookieHeader,
  forwardResponse,
  sendError
};
