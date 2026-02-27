require('dotenv').config();
require('./config/components/timeConfig');

const cors = require('cors');
const express = require("express");
const path = require('path');
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { connectDB } = require("./config/config");
const { initSocket } = require("./services/socket");
const { checkMaintenanceMode } = require("./middlewares/checkMaintenanceMode");

const app =  express();
const PORT =  process.env.PORT;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const expected = process.env.ADMIN_SOCKET_TOKEN;
  if (expected && token === expected) {
    return next();
  }

  if (token) {
    try {
      const { uid } = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { uid };
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  }

  if (expected) {
    return next(new Error("Unauthorized"));
  }

  return next();
});

io.on("connection", (socket) => {
  socket.join("admins");
});

initSocket(io);

// Inicializar cron jobs
if (process.env.NODE_ENV !== 'test') {
  require('./helpers/cronAuto');
  console.log('Cron job para promociones iniciado');
}


app.use(cors());
app.use(express.json());
app.use("/api", checkMaintenanceMode);
app.use("/api", require('./routes/index'));



server.listen(PORT, "0.0.0.0", () => {
  connectDB();
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log(`Zona horaria: ${process.env.TZ}`);
});



app.get('*', (req, res) => {
   res.sendFile( path.resolve( __dirname, 'public/index.html' ) );
});


