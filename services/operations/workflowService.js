const { orderModel } = require("../../models/index");

const getEnabledStages = (config) =>
  (config?.operations?.workflow?.stages || []).filter((s) => s.enabled !== false);

const getNextStageKey = (config, currentStageKey) => {
  const stages = getEnabledStages(config);
  const index = stages.findIndex((s) => s.key === currentStageKey);
  if (index === -1) return null;
  const next = stages[index + 1];
  return next ? next.key : null;
};

const claimNextOrderStage = async ({ tenantId, branchId, stageKey, userId, role }) => {
  const now = new Date();
  return orderModel.findOneAndUpdate(
    {
      tenantId,
      branchId,
      currentStageKey: stageKey,
      stageHistory: {
        $not: { $elemMatch: { stageKey, status: { $in: ["ASSIGNED", "IN_PROGRESS"] } } }
      }
    },
    {
      $push: {
        stageHistory: {
          stageKey,
          role,
          assignedTo: userId,
          assignedAt: now,
          status: "ASSIGNED"
        }
      }
    },
    { new: true, sort: { createdAt: 1 } }
  );
};

const claimOrderStage = async ({
  tenantId,
  branchId,
  stageKey,
  orderId,
  userId,
  role
}) => {
  const now = new Date();
  return orderModel.findOneAndUpdate(
    {
      _id: orderId,
      tenantId,
      branchId,
      currentStageKey: stageKey,
      stageHistory: {
        $not: { $elemMatch: { stageKey, status: { $in: ["ASSIGNED", "IN_PROGRESS"] } } }
      }
    },
    {
      $push: {
        stageHistory: {
          stageKey,
          role,
          assignedTo: userId,
          assignedAt: now,
          status: "ASSIGNED"
        }
      }
    },
    { new: true }
  );
};

const startOrderStage = async (orderId, stageKey, userId) =>
  orderModel.findOneAndUpdate(
    {
      _id: orderId,
      currentStageKey: stageKey,
      stageHistory: { $elemMatch: { stageKey, assignedTo: userId, status: "ASSIGNED" } }
    },
    {
      $set: {
        "stageHistory.$.status": "IN_PROGRESS",
        "stageHistory.$.startedAt": new Date()
      }
    },
    { new: true }
  );

const completeOrderStage = async (orderId, stageKey, userId, config) => {
  const nextStageKey = getNextStageKey(config, stageKey);
  const update = {
    $set: {
      "stageHistory.$.status": "COMPLETED",
      "stageHistory.$.completedAt": new Date(),
      currentStageKey: nextStageKey
    }
  };

  return orderModel.findOneAndUpdate(
    {
      _id: orderId,
      currentStageKey: stageKey,
      stageHistory: { $elemMatch: { stageKey, assignedTo: userId } }
    },
    update,
    { new: true }
  );
};

module.exports = {
  getEnabledStages,
  getNextStageKey,
  claimNextOrderStage,
  claimOrderStage,
  startOrderStage,
  completeOrderStage
};
