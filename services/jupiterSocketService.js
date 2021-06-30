
const logger = require('../utils/logger')(module);

const getDisconnectingEvent = (reason) => {
    const event = {
        event: "disconnecting",
        reason: reason
    }
    return JSON.stringify(event)
}

const disconnect = (ws, reason) => {
    ws.send(getDisconnectingEvent(reason))
    ws.terminate()
}

const connection = function (wss) {
  logger.info('jupiter connected');
  console.log("connecting chatWss...");
  ws.connectionTimeout = setTimeout(() => {
      console.log('connectionTimeout');
      disconnect(ws, "connection time exceeds 5 minutes")
  }, 300000);
  ws.on('message', (message) => {
      console.log('chatWss:',message);
  });
  ws.on('close', () => {
      console.log('connection closed');
      clearTimeout(ws.connectionTimeout)
  });
  console.log("connected");
};

module.exports = { connection };
