const { walletModel, userModel } = require("../models/index");

const toCents = (amount) => Math.round(Number(amount || 0) * 100);

const toCredits = (balanceCents) => Number((balanceCents / 100).toFixed(2));

const getOrCreateWallet = async (userId, session) => {
  let wallet = await walletModel.findOne({ userId }).session(session);
  if (wallet) return wallet;

  const user = await userModel.findById(userId).session(session);
  const initialCents = toCents(user?.credits || 0);

  wallet = new walletModel({
    userId,
    balanceCents: initialCents,
    currency: "USD"
  });
  await wallet.save({ session });
  return wallet;
};

const updateUserCreditsMirror = async (userId, balanceCents, session) => {
  const credits = toCredits(balanceCents);
  await userModel.updateOne({ _id: userId }, { $set: { credits } }, { session });
  return credits;
};

module.exports = {
  toCents,
  toCredits,
  getOrCreateWallet,
  updateUserCreditsMirror
};
