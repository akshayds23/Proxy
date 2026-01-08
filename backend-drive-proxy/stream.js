const { handleStreamRequest } = require("../streamHandler");

module.exports = async (req, res) => {
  await handleStreamRequest(req, res);
};
