require('dotenv').config();
const cors = require('cors');
const express = require("express");
const connectDB = require("./connectDB");
const { socketController } = require('../../controllers/dataRealTime')

const dir = '../..'
class Server {
    constructor(){
        this.app = express();
        this.port = process.env.PORT;
        this.server = require('http').createServer(this.app);
        //cors socket
        this.io = require('socket.io')(this.server, {
            cors: {
              origin: '*',
            }
        });

        // Conectar Base de Datos
        this.connectionDB();
        // Middlewares
        this.middlewares();
        //Routes
        this.routes();
        //sockets
        this.sockets();

    }

    middlewares(){
        // CORS
        this.app.use(cors());
        // Lectura
        this.app.use(express.json());
        // get
        this.app.get('*', (req, res) => {
            res.sendFile( require('path').resolve( __dirname, `${dir}/public/index.html` ) );
        });
    }

    async connectionDB(){
        await connectDB();
    }

    sockets(){
        this.io.on('connection', socketController)
    }

    routes(){
        this.app.use("/api", require(`${dir}/routes/index`));
    }

    listen(){
        this.server.listen(this.port, ()=>{
            console.log(`Servidor corriendo en el puerto ${this.port}`);
        })        
    }

}

module.exports = Server;