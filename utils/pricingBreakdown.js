const Decimal = require("decimal.js");

const round2 = (value) =>
  Number(new Decimal(value || 0).toDecimalPlaces(2).toNumber());

const getPriceBreakdown = ({
  price = 0,
  quantity = 1,
  taxRate = 0,
  priceIncludesTax = false,
}) => {
  const qty = new Decimal(quantity || 0);
  const unitPrice = new Decimal(price || 0);
  const rate = new Decimal(taxRate || 0);

  if (qty.lte(0)) {
    return {
      subtotal: 0,
      tax: 0,
      total: 0,
    };
  }

  const linePrice = unitPrice.times(qty);

  if (priceIncludesTax) {
    const divisor = new Decimal(1).plus(rate);
    const subtotal = linePrice.div(divisor);
    const tax = linePrice.minus(subtotal);
    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(linePrice),
    };
  }

  const subtotal = linePrice;
  const tax = subtotal.times(rate);
  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    total: round2(subtotal.plus(tax)),
  };
};

module.exports = {
  getPriceBreakdown,
};
