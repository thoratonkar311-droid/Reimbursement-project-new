/**
 * auth.js middleware
 * JWT authentication & role-based authorization
 */

const jwt = require("jsonwebtoken");
const { findById } = require("../utils/dataStore");

const JWT_SECRET = process.env.JWT_SECRET || "reimburse_iq_dev_secret_2024";

// ─── Verify JWT token ─────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findById("users", decoded.userId);
    if (!user) return res.status(401).json({ error: "User not found." });
    req.user = user;
    req.companyId = user.companyId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// ─── Role-based guards ────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };
}

const requireAdmin   = requireRole("admin");
const requireManager = requireRole("admin", "manager");

// ─── Generate token ───────────────────────────────────────────
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { authenticate, requireAdmin, requireManager, generateToken };
