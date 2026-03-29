/**
 * ReimburseIQ - Reimbursement Management System
 * Main Express Application Entry Point
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const expenseRoutes = require("./routes/expenses");
const approvalRoutes = require("./routes/approvals");
const companyRoutes = require("./routes/company");
const ocrRoutes = require("./routes/ocr");
const currencyRoutes = require("./routes/currency");

const { initDataStore } = require("./utils/dataStore");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Initialize data store ──────────────────────────────────
initDataStore();

// ─── Security Middleware ─────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled to serve frontend
  crossOriginEmbedderPolicy: false,
}));

// ─── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// ─── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));

// ─── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Logging ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ─── Static Files (Frontend) ─────────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── API Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/currency", currencyRoutes);

// ─── Health Check ────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    service: "ReimburseIQ API",
  });
});

// ─── Serve Frontend for all non-API routes ───────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ─── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "File too large. Max 10MB allowed." });
  }
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ReimburseIQ Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📁 Data directory: ${process.env.DATA_DIR || "./data"}\n`);
});

module.exports = app;
