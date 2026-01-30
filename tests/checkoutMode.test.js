const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveCheckoutData } = require("../services/pos/checkoutMode");

const buildConfig = (queuesTickets, queues = []) => ({
  modules: { queuesTickets },
  operations: { queues }
});

test("DIRECT mode returns checkout data without ticket", () => {
  const config = buildConfig(false);
  const data = resolveCheckoutData({
    tenantConfig: config,
    ticket: null,
    ticketId: null,
    tenantId: "T1",
    branchId: "B1",
    defaultQueueKey: "checkout"
  });

  assert.equal(data.checkoutMode, "DIRECT");
  assert.equal(data.queueKey, "checkout");
  assert.equal(data.ticketId, null);
  assert.ok(data.checkoutSessionId);
});

test("DIRECT mode rejects ticketId", () => {
  const config = buildConfig(false);
  assert.throws(
    () =>
      resolveCheckoutData({
        tenantConfig: config,
        ticket: null,
        ticketId: "123",
        tenantId: "T1",
        branchId: "B1",
        defaultQueueKey: "checkout"
      }),
    (err) => err.code === "TICKET_NOT_ALLOWED" && err.status === 400
  );
});

test("TICKET mode accepts valid ticket", () => {
  const config = buildConfig(true, [{ key: "checkout", enabled: true }]);
  const data = resolveCheckoutData({
    tenantConfig: config,
    ticket: {
      _id: "tk1",
      tenantId: "T1",
      branchId: "B1",
      status: "WAITING",
      serviceType: "checkout"
    },
    ticketId: "tk1",
    tenantId: "T1",
    branchId: "B1",
    defaultQueueKey: "checkout"
  });

  assert.equal(data.checkoutMode, "TICKET");
  assert.equal(data.queueKey, "checkout");
  assert.equal(data.ticketId, "tk1");
});

test("TICKET mode rejects closed tickets", () => {
  const config = buildConfig(true, [{ key: "checkout", enabled: true }]);
  assert.throws(
    () =>
      resolveCheckoutData({
        tenantConfig: config,
        ticket: {
          _id: "tk1",
          tenantId: "T1",
          branchId: "B1",
          status: "CLOSED",
          serviceType: "checkout"
        },
        ticketId: "tk1",
        tenantId: "T1",
        branchId: "B1",
        defaultQueueKey: "checkout"
      }),
    (err) => err.code === "TICKET_NOT_OPEN" && err.status === 409
  );
});

test("TICKET mode rejects disabled queues", () => {
  const config = buildConfig(true, [{ key: "checkout", enabled: false }]);
  assert.throws(
    () =>
      resolveCheckoutData({
        tenantConfig: config,
        ticket: {
          _id: "tk1",
          tenantId: "T1",
          branchId: "B1",
          status: "WAITING",
          serviceType: "checkout"
        },
        ticketId: "tk1",
        tenantId: "T1",
        branchId: "B1",
        defaultQueueKey: "checkout"
      }),
    (err) => err.code === "QUEUE_DISABLED" && err.status === 403
  );
});

test("TICKET mode rejects wrong queue", () => {
  const config = buildConfig(true, [{ key: "pickup", enabled: true }]);
  assert.throws(
    () =>
      resolveCheckoutData({
        tenantConfig: config,
        ticket: {
          _id: "tk1",
          tenantId: "T1",
          branchId: "B1",
          status: "WAITING",
          serviceType: "pickup"
        },
        ticketId: "tk1",
        tenantId: "T1",
        branchId: "B1",
        defaultQueueKey: "checkout"
      }),
    (err) => err.code === "TICKET_WRONG_QUEUE" && err.status === 409
  );
});
