/**
 * routes/expenses.js
 * Expense CRUD: submit, list (role-filtered), get by id
 */

const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { authenticate, requireManager } = require("../middleware/auth");
const { findAll, findById, findOne, insert, updateById } = require("../utils/dataStore");
const { convert } = require("../utils/currency");

// ─── GET /api/expenses ─────────────────────────────────────────
router.get("/", authenticate, (req, res) => {
  const { status, userId } = req.query;
  let expenses = findAll("expenses", { companyId: req.companyId });

  // Role filtering
  if (req.user.role === "employee") {
    expenses = expenses.filter(e => e.userId === req.user.id);
  } else if (req.user.role === "manager") {
    // Manager sees their team + expenses pending their approval
    const myTeam = findAll("users", { companyId: req.companyId, managerId: req.user.id }).map(u => u.id);
    expenses = expenses.filter(e =>
      e.userId === req.user.id ||
      myTeam.includes(e.userId) ||
      e.approvalSteps?.some(s => s.approverId === req.user.id)
    );
  }

  if (status) expenses = expenses.filter(e => e.status === status);
  if (userId) expenses = expenses.filter(e => e.userId === userId);

  // Enrich with submitter info
  const users = findAll("users", { companyId: req.companyId });
  expenses = expenses.map(e => {
    const submitter = users.find(u => u.id === e.userId);
    return { ...e, submitterName: submitter?.name || "Unknown", submitterEmail: submitter?.email };
  });

  res.json(expenses.sort((a, b) => b.createdAt - a.createdAt));
});

// ─── GET /api/expenses/pending-mine ───────────────────────────
router.get("/pending-mine", authenticate, (req, res) => {
  const expenses = findAll("expenses", { companyId: req.companyId }).filter(e =>
    (e.status === "pending" || e.status === "in_review") &&
    e.approvalSteps?.some(s => s.approverId === req.user.id && s.status === "pending")
  );
  res.json(expenses);
});

// ─── GET /api/expenses/:id ─────────────────────────────────────
router.get("/:id", authenticate, (req, res) => {
  const expense = findById("expenses", req.params.id);
  if (!expense || expense.companyId !== req.companyId) return res.status(404).json({ error: "Expense not found." });
  if (req.user.role === "employee" && expense.userId !== req.user.id) {
    return res.status(403).json({ error: "Access denied." });
  }
  const users = findAll("users", { companyId: req.companyId });
  const submitter = users.find(u => u.id === expense.userId);
  res.json({ ...expense, submitterName: submitter?.name, submitterEmail: submitter?.email });
});

// ─── POST /api/expenses ────────────────────────────────────────
router.post("/", authenticate, async (req, res) => {
  try {
    const { amount, currency, category, description, date } = req.body;
    if (!amount || !currency || !category || !description || !date) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Get company currency
    const { findById: fbid } = require("../utils/dataStore");
    const company = fbid("companies", req.companyId);
    const companyCurrency = company?.currency || "USD";

    // Convert to company currency
    let amountInCompanyCurrency = parseFloat(amount);
    if (currency !== companyCurrency) {
      amountInCompanyCurrency = await convert(parseFloat(amount), currency, companyCurrency);
    }

    // Build approval steps from flow
    const flow = findOne("flows", { companyId: req.companyId });
    let approvalSteps = [];
    
    if (flow?.steps?.length > 0) {
      approvalSteps = flow.steps.map((s, i) => ({
        ...s,
        stepIndex: i,
        status: i === 0 ? "pending" : "waiting",
        comments: "",
        approvedAt: null,
      }));
    } else {
      // Fallback: route to employee's manager if set
      const submitter = fbid("users", req.user.id);
      if (submitter?.managerId) {
        const manager = fbid("users", submitter.managerId);
        if (manager) {
          approvalSteps = [{
            stepIndex: 0, approverId: manager.id, approverName: manager.name,
            role: "manager", isManagerApprover: true, status: "pending", comments: "", approvedAt: null,
          }];
        }
      }
    }

    const expense = {
      id: uuidv4(),
      userId: req.user.id,
      companyId: req.companyId,
      amount: parseFloat(amount),
      currency,
      amountInCompanyCurrency,
      category,
      description,
      date,
      status: approvalSteps.length > 0 ? "pending" : "approved",
      approvalSteps,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    insert("expenses", expense);
    res.status(201).json(expense);
  } catch (err) {
    console.error("Submit expense error:", err);
    res.status(500).json({ error: "Failed to submit expense." });
  }
});

// ─── DELETE /api/expenses/:id (admin override) ─────────────────
router.delete("/:id", authenticate, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only." });
  const { deleteById } = require("../utils/dataStore");
  deleteById("expenses", req.params.id);
  res.json({ message: "Expense deleted." });
});

module.exports = router;
