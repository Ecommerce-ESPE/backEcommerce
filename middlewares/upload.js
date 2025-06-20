const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;
// Este middleware configura multer para almacenar archivos en memoria
// Esto es útil para subir archivos a servicios externos como Cloudinary