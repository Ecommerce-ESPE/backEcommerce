const mongoose = require("mongoose");
const { userModel, itemModel } = require("../../models/index");

const getWishlist = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.uid)
      .select("wishlist")
      .populate({
        path: "wishlist",
        select: "nameProduct slug banner images value category subcategory rating visibility",
      })
      .lean();

    const items = Array.isArray(user?.wishlist)
      ? user.wishlist.filter((item) => item && item.visibility !== false)
      : [];

    return res.json({
      ok: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo wishlist",
    });
  }
};

const addWishlistItem = async (req, res) => {
  try {
    const itemId = req.params.itemId || req.body?.itemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        ok: false,
        message: "itemId inválido",
      });
    }

    const itemExists = await itemModel.exists({ _id: itemId, visibility: true });
    if (!itemExists) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    await userModel.updateOne(
      { _id: req.uid },
      { $addToSet: { wishlist: itemId } }
    );

    return res.json({
      ok: true,
      message: "Producto agregado a wishlist",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error agregando a wishlist",
    });
  }
};

const removeWishlistItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        ok: false,
        message: "itemId inválido",
      });
    }

    await userModel.updateOne(
      { _id: req.uid },
      { $pull: { wishlist: itemId } }
    );

    return res.json({
      ok: true,
      message: "Producto eliminado de wishlist",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error eliminando de wishlist",
    });
  }
};

module.exports = {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
};
