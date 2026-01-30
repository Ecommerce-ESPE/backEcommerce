const Decimal = require("decimal.js");

const getIvaRateForDate = (config, dateISO) => {
  const defaultRate = Number(config?.tax?.iva?.defaultRate ?? 0.15);
  const effectiveRates = config?.tax?.iva?.effectiveRates || [];
  const targetDate = dateISO ? new Date(dateISO) : new Date();

  const applicable = effectiveRates
    .filter((r) => r?.from && new Date(r.from) <= targetDate)
    .sort((a, b) => new Date(a.from) - new Date(b.from));

  if (applicable.length === 0) return defaultRate;
  const last = applicable[applicable.length - 1];
  return Number(last.rate ?? defaultRate);
};

const getProductTaxRate = (config, product, dateISO) => {
  const defaultRate = getIvaRateForDate(config, dateISO);
  const rules = config?.tax?.iva?.productTaxRules || [];
  const categoryId = product?.category ? String(product.category) : null;
  const tags = Array.isArray(product?.tags) ? product.tags.map(String) : [];

  const categoryRule = rules.find(
    (rule) => rule?.match?.categoryId && String(rule.match.categoryId) === categoryId
  );
  if (categoryRule) return Number(categoryRule.rate);

  const tagRule = rules.find(
    (rule) => rule?.match?.tag && tags.includes(String(rule.match.tag))
  );
  if (tagRule) return Number(tagRule.rate);

  return defaultRate;
};

const computeTaxSnapshot = ({ items, dateISO, config, shipping = 0 }) => {
  const priceIncludesTax = Boolean(config?.tax?.priceIncludesTax);
  const effectiveRateAtDate = getIvaRateForDate(config, dateISO);
  const calculatedAt = new Date();

  let subtotal = new Decimal(0);
  let totalTax = new Decimal(0);

  const normalizedItems = (items || []).map((item) => {
    const qty = new Decimal(item.qty || item.quantity || 0);
    const unitPrice = new Decimal(item.unitPrice || item.price || 0);
    const rate = new Decimal(item.ivaRateApplied ?? item.taxRate ?? 0);

    if (qty.lte(0)) {
      return {
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        qty: qty.toNumber(),
        unitPrice: unitPrice.toNumber(),
        subtotal: 0,
        ivaRateApplied: rate.toNumber(),
        taxAmount: 0,
        totalLine: 0
      };
    }

    let lineSubtotal = unitPrice.times(qty);
    let lineTax = new Decimal(0);

    if (priceIncludesTax) {
      const divisor = new Decimal(1).plus(rate);
      lineSubtotal = unitPrice.div(divisor).times(qty);
      lineTax = unitPrice.times(qty).minus(lineSubtotal);
    } else {
      lineTax = lineSubtotal.times(rate);
    }

    lineSubtotal = lineSubtotal.toDecimalPlaces(2);
    lineTax = lineTax.toDecimalPlaces(2);
    const lineTotal = lineSubtotal.plus(lineTax).toDecimalPlaces(2);

    subtotal = subtotal.plus(lineSubtotal);
    totalTax = totalTax.plus(lineTax);

    return {
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      qty: qty.toNumber(),
      unitPrice: unitPrice.toNumber(),
      subtotal: lineSubtotal.toNumber(),
      ivaRateApplied: rate.toNumber(),
      taxAmount: lineTax.toNumber(),
      totalLine: lineTotal.toNumber()
    };
  });

  const shippingAmount = new Decimal(shipping || 0).toDecimalPlaces(2);
  const total = subtotal.plus(totalTax).plus(shippingAmount).toDecimalPlaces(2);

  return {
    items: normalizedItems,
    totals: {
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      totalTax: totalTax.toDecimalPlaces(2).toNumber(),
      shipping: shippingAmount.toNumber(),
      total: total.toNumber()
    },
    meta: {
      strategy: config?.tax?.strategy || "ecuador_iva",
      priceIncludesTax,
      effectiveRateAtDate,
      calculatedAt
    }
  };
};

module.exports = {
  getIvaRateForDate,
  getProductTaxRate,
  computeTaxSnapshot
};
