// utils/cloudinaryUpload.js
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Sube una imagen a Cloudinary desde un buffer (ej. desde multer memoryStorage)
 * @param {Buffer} fileBuffer - El buffer de la imagen
 * @param {string} folder - Carpeta de Cloudinary donde guardar (ej. 'items', 'categories', etc.)
 * @param {string} filename - Nombre público opcional
 */
const uploadToCloudinary = (fileBuffer, folder = 'general', filename = '') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename || undefined,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

module.exports = {
  uploadToCloudinary
};
