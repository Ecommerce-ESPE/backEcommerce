const { Router } = require("express");
const router = Router();

const { createTag, getTags, getTagById, deleteTag } = require("../controllers/tags");

router.post("/", createTag);
router.get("/", getTags);
router.get("/:id", getTagById);
router.delete("/:id", deleteTag);

module.exports = router;
