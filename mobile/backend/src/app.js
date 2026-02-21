const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const ordersRoutes = require("./routes/orders");
const profileRoutes = require("./routes/profile");
const productsRoutes = require("./routes/products");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use("/profile", profileRoutes);
app.use("/products", productsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ detail: "Sunucu hatasi." });
});

module.exports = app;
