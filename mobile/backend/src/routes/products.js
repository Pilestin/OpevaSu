const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const products = await db.collection("Products").find({}, { projection: { _id: 0 } }).sort({ product_id: 1 }).toArray();
  return res.json({ products });
});

module.exports = router;
