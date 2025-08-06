// Modulo para actualizar automáticamente procesos
const cron = require("node-cron");
const moment = require("moment-timezone");
const {
  itemModel,
  promoBarModel,
  bannerHeroModel,
} = require("../models/index");
const TIMEZONE = process.env.TZ || "America/Guayaquil";

// PRODUCTO PROMOCIONES
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      // Obtener la fecha actual en Ecuador
      const now = moment().tz(TIMEZONE);
      const startOfDay = now.clone().startOf("day").toDate();
      const endOfDay = now.clone().endOf("day").toDate();

      console.log(`[${now.format()}] Actualizando promociones para Ecuador`);

      // 1. Desactivar promociones expiradas
      const productosExpirados = await itemModel.find({
        "promotion.active": true,
        "promotion.endDate": { $lt: startOfDay },
      });

      for (const producto of productosExpirados) {
        producto.promotion.active = false;
        producto.markModified("promotion");
        await producto.save(); // middleware se encarga de recalcular y limpiar
      }

      // 2. Activar promociones que inician hoy
      await itemModel.updateMany(
        {
          "promotion.active": false,
          "promotion.startDate": { $lte: endOfDay },
          "promotion.endDate": { $gte: startOfDay },
        },
        { $set: { "promotion.active": true } }
      );

      console.log(`Promociones actualizadas automáticamente para Ecuador`);
    } catch (error) {
      console.error("Error en actualización automática de promociones:", error);
    }
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  }
);
// BANNER HERO
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      // Obtener la fecha actual en Ecuador
      const now = moment().tz(TIMEZONE);
      const startOfDay = now.clone().startOf("day").toDate();
      const endOfDay = now.clone().endOf("day").toDate();

      console.log(`[${now.format()}] Actualizando banners hero para Ecuador`);

      // 1. Desactivar banners expirados
      await bannerHeroModel.updateMany(
        {
          active: true,
          endDate: { $lt: startOfDay },
        },
        { $set: { active: false } }
      );

      // 2. Activar banners que inician hoy
      await bannerHeroModel.updateMany(
        {
          active: false,
          startDate: { $lte: endOfDay },
          endDate: { $gte: startOfDay },
        },
        { $set: { active: true } }
      );

      console.log(`Banners hero actualizados automáticamente para Ecuador`);
    } catch (error) {
      console.error(
        "Error en actualización automática de banners hero:",
        error
      );
    }
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  }
);
// PROMO BAR
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      // Obtener la fecha actual en Ecuador
      const now = moment().tz(TIMEZONE);
      const startOfDay = now.clone().startOf("day").toDate();
      const endOfDay = now.clone().endOf("day").toDate();

      console.log(`[${now.format()}] Actualizando promo bar para Ecuador`);

      // 1. Desactivar promo bars expiradas
      await promoBarModel.updateMany(
        {
          visible: true,
          endDate: { $lt: startOfDay },
        },
        { $set: { visible: false } }
      );

      // 2. Activar promo bars que inician hoy
      await promoBarModel.updateMany(
        {
          visible: false,
          startDate: { $lte: endOfDay },
          endDate: { $gte: startOfDay },
        },
        { $set: { visible: true } }
      );

      console.log(`Promo bar actualizada automáticamente para Ecuador`);
    } catch (error) {
      console.error("Error en actualización automática de promo bar:", error);
    }
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  }
);
// prueba "*/1 * * * *"