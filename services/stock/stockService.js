const { itemModel } = require("../../models/index");

const updateStock = async (items, session) => {
  const updates = items.map((item) => ({
    updateOne: {
      filter: {
        _id: item.productId,
        "value._id": item.variantId,
      },
      update: {
        $inc: {
          "value.$.stock": -item.quantity,
        },
      },
    },
  }));

  await itemModel.bulkWrite(updates, { session });
};

module.exports = {
  updateStock,
};
