const http = require("http");
const { handleStreamRequest } = require("./streamHandler");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = http.createServer(handleStreamRequest);

server.listen(PORT, () => {
  console.log(`Drive proxy listening on http://localhost:${PORT}`);
});
