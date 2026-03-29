/**
 * routes/approvals.js
 * Approval workflow engine: approve, reject, conditional rules
 */

const router = require("express").Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { findById, findOne, updateById, findAll } = require("../utils/dataStore");

// ─── POST /api/approvals/:expenseId/action ────────────────────
router.post("/:expenseId/action", authenticate, requireManager, (req, res) => {
  try {
    const { action, comment = "" } = req.body; // action: 'approve' | 'reject'
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'." });
    }

    const expense = findById("expenses", req.params.expenseId);
    if (!expense || expense.companyId !== req.companyId) {
      return res.status(404).json({ error: "Expense not found." });
    }
    if (!["pending", "in_review"].includes(expense.status)) {
      return res.status(400).json({ error: "Expense is already resolved." });
    }

    const currentIdx = expense.currentStep || 0;
    const steps = [...expense.approvalSteps];
    const currentStep = steps[currentIdx];

    // Validate this user can approve this step (or is admin)
    const isAdmin = req.user.role === "admin";
    const isCurrentApprover = currentStep?.approverId === req.user.id && currentStep?.status === "pending";
    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({ error: "Not your turn to approve this expense." });
    }

    // Update current step
    steps[currentIdx] = {
      ...steps[currentIdx],
      status: action === "approve" ? "approved" : "rejected",
      comments: comment,
      approvedAt: Date.now(),
      approvedBy: req.user.id,
    };

    // ─── Evaluate approval rules ─────────────────────────────
    const flow = findOne("flows", { companyId: req.companyId });
    const rule = flow?.rule || { type: "sequential" };
    let finalStatus = null;

    if (action === "reject") {
      finalStatus = "rejected";
    } else {
      const totalSteps = steps.length;
      const approvedCount = steps.filter(s => s.status === "approved").length;

      // Specific approver rule
      if ((rule.type === "specific" || rule.type === "hybrid") && rule.specificApproverId === req.user.id) {
        finalStatus = "approved"; // Auto-approve
      }

      // Percentage rule
      if (!finalStatus && (rule.type === "percentage" || rule.type === "hybrid")) {
        const pct = totalSteps > 0 ? (approvedCount / totalSteps) * 100 : 100;
        if (pct >= (rule.percentage || 60)) finalStatus = "approved";
      }

      // Sequential: advance to next step or finish
      if (!finalStatus) {
        const nextIdx = currentIdx + 1;
        if (nextIdx >= totalSteps) {
          finalStatus = "approved"; // All steps done
        } else {
          // Activate next step
          steps[nextIdx] = { ...steps[nextIdx], status: "pending" };
          const updated = updateById("expenses", expense.id, {
            approvalSteps: steps,
            currentStep: nextIdx,
            status: "in_review",
          });
          return res.json({ expense: updated, message: `Approved. Forwarded to step ${nextIdx + 1}.` });
        }
      }
    }

    // Apply final status
    const updated = updateById("expenses", expense.id, {
      approvalSteps: steps,
      status: finalStatus,
      resolvedAt: Date.now(),
      resolvedBy: req.user.id,
    });

    res.json({ expense: updated, message: `Expense ${finalStatus}.` });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Failed to process approval." });
  }
});

// ─── GET /api/approvals/stats ─────────────────────────────────
router.get("/stats", authenticate, requireManager, (req, res) => {
  const expenses = findAll("expenses", { companyId: req.companyId });
  const stats = {
    total: expenses.length,
    pending: expenses.filter(e => e.status === "pending").length,
    in_review: expenses.filter(e => e.status === "in_review").length,
    approved: expenses.filter(e => e.status === "approved").length,
    rejected: expenses.filter(e => e.status === "rejected").length,
    totalApprovedAmount: expenses.filter(e => e.status === "approved")
      .reduce((sum, e) => sum + (e.amountInCompanyCurrency || 0), 0),
    pendingForMe: expenses.filter(e =>
      (e.status === "pending" || e.status === "in_review") &&
      e.approvalSteps?.some(s => s.approverId === req.user.id && s.status === "pending")
    ).length,
  };
  res.json(stats);
});

// ─── POST /api/approvals/:expenseId/override ─ admin override ─
router.post("/:expenseId/override", authenticate, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only." });
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const updated = updateById("expenses", req.params.expenseId, {
    status,
    overriddenBy: req.user.id,
    overriddenAt: Date.now(),
  });
  if (!updated) return res.status(404).json({ error: "Expense not found." });
  res.json({ expense: updated, message: `Expense overridden to ${status} by admin.` });
});

module.exports = router;
