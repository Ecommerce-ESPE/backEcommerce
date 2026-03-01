const { itemModel } = require("../../models/index");

const updateStock = async (items, session) => {
  for (const item of items) {
    const result = await itemModel.updateOne(
      {
        _id: item.productId,
        value: {
          $elemMatch: {
            _id: item.variantId,
            stock: { $gte: item.quantity },
          },
        },
      },
      {
        $inc: {
          "value.$.stock": -item.quantity,
        },
      },
      { session },
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        `Stock insuficiente o variante no disponible para ${item.name || item.productId}`,
      );
    }
  }
};

module.exports = {
  updateStock,
};
