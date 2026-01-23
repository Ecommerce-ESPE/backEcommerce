const mongoose = require("mongoose");
const { walletModel, walletTransactionModel } = require("../models/index");
const { getOrCreateWallet, updateUserCreditsMirror } = require("./walletLedger");

const ensureCents = (amountCents) => {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents inválido");
  }
};

const getExistingByKey = async (idempotencyKey) =>
  walletTransactionModel.findOne({ idempotencyKey }).lean();

const chargeCredits = async ({
  orderId,
  userId,
  amountCents,
  idempotencyKey,
  currency = "USD",
  metadata = {},
  session: externalSession = null
}) => {
  ensureCents(amountCents);
  if (!idempotencyKey) throw new Error("idempotencyKey requerido");

  const existing = await getExistingByKey(idempotencyKey);
  if (existing) {
    return {
      transactionId: existing._id,
      status: existing.status,
      remainingCredits: (existing.balanceAfterCents || 0) / 100
    };
  }

  const session = externalSession || (await mongoose.startSession());
  let result;
  const execute = async () => {
    await getOrCreateWallet(userId, session);

    const wallet = await walletModel.findOneAndUpdate(
      { userId, balanceCents: { $gte: amountCents } },
      { $inc: { balanceCents: -amountCents } },
      { new: true, session }
    );

    if (!wallet) {
      const failedTx = await walletTransactionModel.create(
        [
          {
            userId,
            orderId,
            type: "debit",
            amountCents,
            currency,
            status: "failed",
            idempotencyKey,
            metadata
          }
        ],
        { session }
      );
      result = {
        transactionId: failedTx[0]._id,
        status: "failed",
        remainingCredits: null
      };
      return;
    }

    const tx = await walletTransactionModel.create(
      [
        {
          userId,
          orderId,
          type: "debit",
          amountCents,
          currency,
          status: "completed",
          idempotencyKey,
          balanceAfterCents: wallet.balanceCents,
          metadata
        }
      ],
      { session }
    );

    await updateUserCreditsMirror(userId, wallet.balanceCents, session);

    result = {
      transactionId: tx[0]._id,
      status: "completed",
      remainingCredits: wallet.balanceCents / 100
    };
  };

  try {
    if (externalSession) {
      await execute();
    } else {
      await session.withTransaction(async () => {
        await execute();
      });
    }
  } finally {
    if (!externalSession) session.endSession();
  }

  return result;
};

const refundCredits = async ({
  orderId,
  userId,
  amountCents,
  reason = "refund",
  idempotencyKey,
  currency = "USD",
  metadata = {},
  session: externalSession = null
}) => {
  ensureCents(amountCents);
  if (!idempotencyKey) throw new Error("idempotencyKey requerido");

  const existing = await getExistingByKey(idempotencyKey);
  if (existing) {
    return {
      transactionId: existing._id,
      status: existing.status,
      remainingCredits: (existing.balanceAfterCents || 0) / 100
    };
  }

  const session = externalSession || (await mongoose.startSession());
  let result;
  const execute = async () => {
    await getOrCreateWallet(userId, session);

    const wallet = await walletModel.findOneAndUpdate(
      { userId },
      { $inc: { balanceCents: amountCents } },
      { new: true, session }
    );

    const tx = await walletTransactionModel.create(
      [
        {
          userId,
          orderId,
          type: "credit",
          amountCents,
          currency,
          status: "completed",
          idempotencyKey,
          balanceAfterCents: wallet.balanceCents,
          metadata: { reason, ...metadata }
        }
      ],
      { session }
    );

    await updateUserCreditsMirror(userId, wallet.balanceCents, session);

    result = {
      transactionId: tx[0]._id,
      status: "completed",
      remainingCredits: wallet.balanceCents / 100
    };
  };

  try {
    if (externalSession) {
      await execute();
    } else {
      await session.withTransaction(async () => {
        await execute();
      });
    }
  } finally {
    if (!externalSession) session.endSession();
  }

  return result;
};

module.exports = {
  chargeCredits,
  refundCredits
};
