require('dotenv').config();
require('./config/components/timeConfig');

const cors = require('cors');
const express = require("express");
const path = require('path');
const {connectDB} = require("./config/config");

const app =  express();
const PORT =  process.env.PORT;

// Inicializar cron jobs
if (process.env.NODE_ENV !== 'test') {
  require('./helpers/cronAuto');
  console.log('Cron job para promociones iniciado');
}


app.use(cors());
app.use(express.json());
app.use("/api", require('./routes/index'));



app.listen(PORT, ()=>{
    connectDB();
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Zona horaria: ${process.env.TZ}`);

})



app.get('*', (req, res) => {
   res.sendFile( path.resolve( __dirname, 'public/index.html' ) );
});


