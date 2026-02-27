const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeSearchTerm,
  clampInteger,
  computeSuggestionScore,
} = require("../utils/itemSearch");

test("sanitizeSearchTerm returns empty string for empty input", () => {
  assert.equal(sanitizeSearchTerm("   "), "");
});

test("sanitizeSearchTerm trims, collapses spaces and clamps length", () => {
  const value = sanitizeSearchTerm("  cafe   molido premium  ", 10);
  assert.equal(value, "cafe molid");
});

test("clampInteger applies fallback and boundaries", () => {
  assert.equal(clampInteger(undefined, 1, 15, 8), 8);
  assert.equal(clampInteger("0", 1, 15, 8), 1);
  assert.equal(clampInteger("99", 1, 15, 8), 15);
});

test("computeSuggestionScore prioritizes exact over prefix and contains", () => {
  const exact = computeSuggestionScore({ nameProduct: "iPhone 15", slug: "iphone-15" }, "iphone 15");
  const prefix = computeSuggestionScore({ nameProduct: "iPhone 15 Pro", slug: "iphone-15-pro" }, "iphone");
  const contains = computeSuggestionScore({ nameProduct: "Funda para iPhone", slug: "funda-iphone" }, "iphone");

  assert.ok(exact > prefix);
  assert.ok(prefix > contains);
});

test("computeSuggestionScore supports brand string and populated object", () => {
  const fromString = computeSuggestionScore({ nameProduct: "Case", brand: "Apple Store" }, "apple");
  const fromObject = computeSuggestionScore(
    { nameProduct: "Case", brand: { name: "Apple Store", slug: "apple-store" } },
    "apple"
  );

  assert.ok(fromString > 0);
  assert.ok(fromObject > 0);
});
