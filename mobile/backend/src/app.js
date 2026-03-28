const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const sessionAuthRoutes = require("./routes/sessionAuth");
const ordersRoutes = require("./routes/orders");
const profileRoutes = require("./routes/profile");
const productsRoutes = require("./routes/products");
const usersRoutes = require("./routes/users");
const routesRoutes = require("./routes/routes");
const driverLocationsRoutes = require("./routes/driverLocations");
const driverProgressRoutes = require("./routes/driverProgress");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/api/auth", sessionAuthRoutes);
app.use("/orders", ordersRoutes);
app.use("/profile", profileRoutes);
app.use("/products", productsRoutes);
app.use("/users", usersRoutes);
app.use("/routes", routesRoutes);
app.use("/driver-locations", driverLocationsRoutes);
app.use("/driver-progress", driverProgressRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ detail: "Sunucu hatasi." });
});

module.exports = app;
