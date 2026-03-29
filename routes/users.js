/**
 * routes/users.js
 * User management: create, list, update roles, assign managers
 */

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { authenticate, requireAdmin, requireManager } = require("../middleware/auth");
const { findAll, findById, insert, updateById, deleteById } = require("../utils/dataStore");

// ─── GET /api/users ─ list company users ─────────────────────
router.get("/", authenticate, requireManager, (req, res) => {
  const users = findAll("users", { companyId: req.companyId })
    .map(({ password, ...u }) => u);
  res.json(users);
});

// ─── POST /api/users ─ create user (admin only) ───────────────
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, password = "password123", role = "employee", managerId } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email required." });

    const existing = findAll("users", { email: email.toLowerCase() });
    if (existing.length) return res.status(409).json({ error: "Email already in use." });

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      companyId: req.companyId,
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: ["employee", "manager"].includes(role) ? role : "employee",
      managerId: managerId || null,
      createdAt: Date.now(),
    };
    insert("users", user);
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to create user." });
  }
});

// ─── PUT /api/users/:id ─ update role / manager ───────────────
router.put("/:id", authenticate, requireAdmin, (req, res) => {
  const user = findById("users", req.params.id);
  if (!user || user.companyId !== req.companyId) return res.status(404).json({ error: "User not found." });
  if (user.role === "admin") return res.status(403).json({ error: "Cannot modify admin user." });

  const { role, managerId, name } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (role && ["employee", "manager"].includes(role)) updates.role = role;
  if (managerId !== undefined) updates.managerId = managerId || null;

  const updated = updateById("users", req.params.id, updates);
  const { password: _, ...safeUser } = updated;
  res.json(safeUser);
});

// ─── DELETE /api/users/:id ────────────────────────────────────
router.delete("/:id", authenticate, requireAdmin, (req, res) => {
  const user = findById("users", req.params.id);
  if (!user || user.companyId !== req.companyId) return res.status(404).json({ error: "User not found." });
  if (user.role === "admin") return res.status(403).json({ error: "Cannot delete admin." });
  deleteById("users", req.params.id);
  res.json({ message: "User deleted." });
});

// ─── GET /api/users/managers ─ list managers ─────────────────
router.get("/managers", authenticate, (req, res) => {
  const managers = findAll("users", { companyId: req.companyId })
    .filter(u => u.role === "manager" || u.role === "admin")
    .map(({ password, ...u }) => u);
  res.json(managers);
});

module.exports = router;
