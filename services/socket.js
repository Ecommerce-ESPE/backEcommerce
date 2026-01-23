let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.IO no inicializado");
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };
