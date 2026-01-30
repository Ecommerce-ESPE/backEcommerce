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

const emitEvent = (event, payload) => {
  try {
    const io = getIO();
    io.emit(event, payload);
  } catch (error) {
    // Socket no inicializado; no bloquear flujo
  }
};

module.exports = { initSocket, getIO, emitEvent };
