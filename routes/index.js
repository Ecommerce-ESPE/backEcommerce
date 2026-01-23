const express = require("express");
const fs = require("fs");
const { auditAuto } = require("../middlewares/auditoria");

const router = express.Router();
const PATH_ROUTES = __dirname;

router.use(auditAuto());

const removeExtension = (fileName)=>{
    //TODO tracks.js [tracks, js]
    return fileName.split(".").shift();
}

const a = fs.readdirSync(PATH_ROUTES).filter((file)=>{
    const name =  removeExtension(file)
    if(name !== "index"){
        console.log
        router.use(`/${name}`, require(`./${file}`));
    }
})
module.exports = router;


