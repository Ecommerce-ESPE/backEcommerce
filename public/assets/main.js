const socket = io();

socket.on('connect',()=>{
    console.log("Cliente conectado")
});

socket.on('connect', ()=>{
    console.log("Cliente desconectado")
})