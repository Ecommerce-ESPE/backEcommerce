const test = require("node:test");
const assert = require("node:assert/strict");

const { getPriceBreakdown } = require("../utils/pricingBreakdown");
const { resolveUnitPrice } = require("../services/pricing/priceResolver");

test("price=1200 with 15% tax included only breaks down, total remains 1200", () => {
  const result = getPriceBreakdown({
    price: 1200,
    quantity: 1,
    taxRate: 0.15,
    priceIncludesTax: true,
  });

  assert.equal(result.subtotal, 1043.48);
  assert.equal(result.tax, 156.52);
  assert.equal(result.total, 1200);
});

test("inactive product promo does not change price", () => {
  const product = {
    _id: "p1",
    category: "c1",
    subcategory: "s1",
    promotion: {
      active: false,
      percentage: 80,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2026-12-31"),
    },
  };
  const variant = {
    _id: "v1",
    originalPrice: 1200,
    discountPrice: null,
  };

  const result = resolveUnitPrice(product, variant, {
    promoIndex: { byProduct: new Map(), bySubcategory: new Map(), byCategory: new Map(), applyAll: [] },
    now: new Date("2026-02-27"),
  });

  assert.equal(result.unitPrice, 1200);
  assert.equal(result.pricingSource, "none");
});

test("active product promo 30% makes total 840 from 1200", () => {
  const product = {
    _id: "p1",
    category: "c1",
    subcategory: "s1",
    promotion: {
      active: true,
      percentage: 30,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2026-12-31"),
    },
  };
  const variant = {
    _id: "v1",
    originalPrice: 1200,
    discountPrice: null,
  };

  const result = resolveUnitPrice(product, variant, {
    promoIndex: { byProduct: new Map(), bySubcategory: new Map(), byCategory: new Map(), applyAll: [] },
    now: new Date("2026-02-27"),
  });

  assert.equal(result.unitPrice, 840);
  assert.equal(result.pricingSource, "productPromo");
  assert.equal(result.promoPercentageApplied, 30);
});
