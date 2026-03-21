require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const categoryModel = require("./models/nosql/category.model");
const itemModel = require("./models/nosql/item.model");
const { normalizeLooseText, escapeRegex } = require("./utils/itemSearch");

const escapeRegExp = escapeRegex;

const resolveCategorySubcategoryFilters = async ({
  categoryQuery,
  subcategoryQuery,
}) => {
  let resolvedCategoryId;
  let resolvedSubcategoryId;

  const rawCategory = String(categoryQuery || "").trim();
  if (rawCategory && rawCategory.toLowerCase() !== "ninguna") {
    if (mongoose.Types.ObjectId.isValid(rawCategory)) {
      resolvedCategoryId = new mongoose.Types.ObjectId(rawCategory);
    } else {
      let categoryDoc = await categoryModel
        .findOne({
          name: { $regex: `^${escapeRegExp(rawCategory)}$`, $options: "i" },
        })
        .select("_id")
        .lean();
      if (!categoryDoc) {
        const normalizedCategory = normalizeLooseText(rawCategory);
        const categories = await categoryModel.find().select("_id name").lean();
        categoryDoc = categories.find(
          (cat) => normalizeLooseText(cat?.name) === normalizedCategory
        );
      }
      if (!categoryDoc) return null;
      resolvedCategoryId = categoryDoc._id;
    }
  }

  const rawSubcategory = String(subcategoryQuery || "").trim();
  if (rawSubcategory && rawSubcategory.toLowerCase() !== "ninguna") {
    if (mongoose.Types.ObjectId.isValid(rawSubcategory)) {
      resolvedSubcategoryId = new mongoose.Types.ObjectId(rawSubcategory);
    } else {
      const normalizedSubcategory = normalizeLooseText(rawSubcategory);
      const categoryDocs = resolvedCategoryId
        ? await categoryModel
            .find({ _id: resolvedCategoryId })
            .select("_id subcategories")
            .lean()
        : await categoryModel.find().select("_id subcategories").lean();

      let matched = null;
      for (const cat of categoryDocs) {
        const sub = (cat.subcategories || []).find(
          (entry) => normalizeLooseText(entry?.name) === normalizedSubcategory
        );
        if (sub?._id) {
          matched = { categoryId: cat._id, subcategoryId: sub._id };
          break;
        }
      }

      fs.writeFileSync("test-output-log.txt", "Matched result: " + JSON.stringify(matched, null, 2) + "\n");
      if (!matched) return null;
      resolvedSubcategoryId = matched.subcategoryId;
      if (!resolvedCategoryId) resolvedCategoryId = matched.categoryId;
    }
  }

  return {
    category: resolvedCategoryId,
    subcategory: resolvedSubcategoryId,
  };
};

mongoose.connect(process.env.DB_URI).then(async () => {
    try {
        const categoryQuery = "electrodomesticos";
        const subcategoryQuery = "computadoras";
        
        fs.appendFileSync("test-output-log.txt", "Testing resolveCategorySubcategoryFilters...\n");
        const result = await resolveCategorySubcategoryFilters({ categoryQuery, subcategoryQuery });
        fs.appendFileSync("test-output-log.txt", "Result: " + JSON.stringify(result, null, 2) + "\n");

        const categoryDocs = await categoryModel.find().select("name subcategories._id subcategories.name").lean();
        fs.appendFileSync("test-output-log.txt", "Category Docs found:\n" + JSON.stringify(categoryDocs.filter(c => normalizeLooseText(c.name) === normalizeLooseText(categoryQuery)), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
});
