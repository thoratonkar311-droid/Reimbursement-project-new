/**
 * js/approvals.js
 * Approval actions (handled via expenses.js doApproval)
 * Admin override support
 */

async function adminOverride(expenseId, status) {
  if (!confirm(`Override expense to ${status}?`)) return;
  try {
    await API.approvals.override(expenseId, { status });
    closeModal("expense-detail-modal");
    showToast(`Expense overridden to ${status}.`, "success");
    refreshCurrentSection();
  } catch (err) {
    showToast(err.message, "error");
  }
}
