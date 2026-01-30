const multer = require('multer');

const storage = multer.memoryStorage();

const maxSizeMbRaw = process.env.UPLOAD_MAX_FILE_SIZE_MB;
const maxFileSizeMb = Number.parseInt(maxSizeMbRaw, 10);
const fileSize = Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0
  ? maxFileSizeMb * 1024 * 1024
  : undefined;

const upload = multer({
  storage,
  ...(fileSize ? { limits: { fileSize } } : {})
});

module.exports = upload;
// Multer in-memory storage; size limit is controlled via UPLOAD_MAX_FILE_SIZE_MB