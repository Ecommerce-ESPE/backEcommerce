// utils/security.js
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

// Asegurar que la clave tenga exactamente 32 bytes
const validateKey = (key) => {
  if (!key) throw new Error('Encryption key is required');
  const buf = Buffer.from(key);
  if (buf.length !== 32) {
    throw new Error(`Invalid key length: ${buf.length} bytes. Required: 32 bytes`);
  }
  return buf;
};

const secretKey = validateKey(
  process.env.ENCRYPTION_KEY || 'default-32-byte-key-1234567890abc!'
);

const encryptData = (text) => {
  if (!text) return null;
  
  try {
    // Generar un nuevo IV para cada cifrado
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Retornar IV y texto cifrado concatenados
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

const decryptData = (text) => {
  if (!text) return null;
  
  try {
    const [ivHex, encrypted] = text.split(':');
    if (!ivHex || !encrypted) throw new Error('Invalid encrypted text format');
    
    const decipher = crypto.createDecipheriv(
      algorithm, 
      secretKey, 
      Buffer.from(ivHex, 'hex')
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

module.exports = {
  encryptData,
  decryptData
};