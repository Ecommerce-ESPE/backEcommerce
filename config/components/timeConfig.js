require('dotenv').config();
const moment = require('moment-timezone');

// Configurar zona horaria global
const configureTimeZone = () => {
  const timezone = process.env.TZ || 'UTC';
  
  // Configurar zona horaria para Node.js
  process.env.TZ = timezone;
  
  // Configurar moment.js
  moment.tz.setDefault(timezone);
  
  console.log(`Zona horaria configurada: ${timezone}`);
  return timezone;
};

module.exports = {
  timezone: configureTimeZone(),
  moment
};