/**
 * routes/company.js
 * Company info and approval flow configuration
 */

const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { findById, findOne, findAll, insert, updateById } = require("../utils/dataStore");

// ─── GET /api/company ──────────────────────────────────────────
router.get("/", authenticate, (req, res) => {
  const company = findById("companies", req.companyId);
  if (!company) return res.status(404).json({ error: "Company not found." });
  res.json(company);
});

// ─── PUT /api/company ──────────────────────────────────────────
router.put("/", authenticate, requireAdmin, (req, res) => {
  const { name } = req.body;
  const updated = updateById("companies", req.companyId, { name });
  res.json(updated);
});

// ─── GET /api/company/flow ─────────────────────────────────────
router.get("/flow", authenticate, (req, res) => {
  const flow = findOne("flows", { companyId: req.companyId });
  res.json(flow || null);
});

// ─── POST /api/company/flow ─────────────────────────────────────
router.post("/flow", authenticate, requireAdmin, (req, res) => {
  const { steps, rule } = req.body;
  const existing = findOne("flows", { companyId: req.companyId });

  // Validate steps reference valid users
  const users = findAll("users", { companyId: req.companyId });
  const validatedSteps = (steps || []).map((s, i) => {
    const user = users.find(u => u.id === s.approverId);
    return {
      stepIndex: i,
      approverId: s.approverId,
      approverName: user?.name || s.approverName || "Unknown",
      role: user?.role || s.role || "manager",
      isManagerApprover: Boolean(s.isManagerApprover),
    };
  });

  const flowData = {
    companyId: req.companyId,
    steps: validatedSteps,
    rule: rule || { type: "sequential" },
    updatedAt: Date.now(),
  };

  let flow;
  if (existing) {
    flow = updateById("flows", existing.id, flowData);
  } else {
    flow = insert("flows", { id: uuidv4(), ...flowData, createdAt: Date.now() });
  }
  res.json(flow);
});

// ─── GET /api/company/stats ────────────────────────────────────
router.get("/stats", authenticate, (req, res) => {
  const expenses = findAll("expenses", { companyId: req.companyId });
  const users = findAll("users", { companyId: req.companyId });
  const company = findById("companies", req.companyId);

  const byCategory = {};
  const byMonth = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.amountInCompanyCurrency || 0);
    const month = new Date(e.date).toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + (e.amountInCompanyCurrency || 0);
  });

  res.json({
    company,
    totalUsers: users.length,
    totalExpenses: expenses.length,
    byStatus: {
      pending: expenses.filter(e => e.status === "pending").length,
      in_review: expenses.filter(e => e.status === "in_review").length,
      approved: expenses.filter(e => e.status === "approved").length,
      rejected: expenses.filter(e => e.status === "rejected").length,
    },
    totalApproved: expenses.filter(e => e.status === "approved")
      .reduce((s, e) => s + (e.amountInCompanyCurrency || 0), 0),
    byCategory,
    byMonth,
  });
});

module.exports = router;
