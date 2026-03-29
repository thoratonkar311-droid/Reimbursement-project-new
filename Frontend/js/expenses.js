/**
 * js/expenses.js
 * Expense submission, listing, filtering, detail view
 */

let convertDebounce = null;
let ocrData = null;
let currentFilter = "all";

// ─── Set today's date on expense form ─────────────────────────
function initExpenseForm() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("exp-date").value = today;
  // Set company currency as default
  const sel = document.getElementById("exp-currency");
  if (window.currentCompany?.currency) {
    const opt = [...sel.options].find(o => o.value === window.currentCompany.currency);
    if (opt) sel.value = window.currentCompany.currency;
  }
}

// ─── Currency conversion hint ─────────────────────────────────
function triggerConvert() {
  clearTimeout(convertDebounce);
  convertDebounce = setTimeout(doConvert, 600);
}

async function doConvert() {
  const amount = parseFloat(document.getElementById("exp-amount").value);
  const from = document.getElementById("exp-currency").value;
  const to = window.currentCompany?.currency || "USD";
  const hint = document.getElementById("convert-hint");

  if (!amount || from === to) { hint.style.display = "none"; return; }

  hint.textContent = "Converting...";
  hint.style.display = "block";
  try {
    const result = await API.currency.convert({ amount, from, to });
    hint.textContent = `≈ ${formatCurrency(result.converted, to)} in ${to}`;
  } catch {
    hint.style.display = "none";
  }
}

// ─── Submit expense ───────────────────────────────────────────
async function submitExpense() {
  const amount = document.getElementById("exp-amount").value;
  const currency = document.getElementById("exp-currency").value;
  const category = document.getElementById("exp-category").value;
  const description = document.getElementById("exp-desc").value.trim();
  const date = document.getElementById("exp-date").value;

  if (!amount || !description || !date) return showToast("Please fill all required fields.", "error");

  try {
    await API.expenses.submit({ amount: parseFloat(amount), currency, category, description, date });
    closeModal("submit-expense-modal");
    clearExpenseForm();
    showToast("Expense submitted successfully!", "success");
    refreshCurrentSection();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function clearExpenseForm() {
  document.getElementById("exp-amount").value = "";
  document.getElementById("exp-desc").value = "";
  document.getElementById("convert-hint").style.display = "none";
  initExpenseForm();
}

// ─── Render expenses table ────────────────────────────────────
function renderExpensesTable(expenses, containerId, { showSubmitter = false } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Filter tabs
  const statuses = ["all", "pending", "in_review", "approved", "rejected"];
  const filtered = currentFilter === "all" ? expenses : expenses.filter(e => e.status === currentFilter);

  const tabs = statuses.map(s => `
    <button class="filter-tab ${currentFilter === s ? "active" : ""}"
      onclick="setFilter('${s}', '${containerId}', ${JSON.stringify(expenses).split('"').join("'")})"
    >${s === "all" ? "All" : s === "in_review" ? "In Review" : capitalize(s)} (${s === "all" ? expenses.length : expenses.filter(e => e.status === s).length})</button>
  `).join("");

  if (!filtered.length) {
    container.innerHTML = `<div class="filter-tabs">${tabs}</div><div class="empty-state"><div class="empty-icon">📭</div><p>No expenses found</p></div>`;
    return;
  }

  const rows = filtered.map(exp => `
    <tr>
      ${showSubmitter ? `<td>${exp.submitterName || "—"}</td>` : ""}
      <td><div class="truncate">${escHtml(exp.description)}</div></td>
      <td style="color:var(--text-2)">${exp.category}</td>
      <td style="text-align:right;font-weight:600">
        ${formatCurrency(exp.amountInCompanyCurrency, window.currentCompany?.currency)}
        ${exp.currency !== window.currentCompany?.currency
          ? `<span class="amount-cc">${formatCurrency(exp.amount, exp.currency)}</span>` : ""}
      </td>
      <td style="color:var(--text-2)">${formatDate(exp.date)}</td>
      <td>${badge(exp.status)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewExpense('${exp.id}')">View</button></td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="filter-tabs">${tabs}</div>
    <div style="overflow-x:auto">
      <table class="expense-table">
        <thead>
          <tr>
            ${showSubmitter ? "<th>Employee</th>" : ""}
            <th>Description</th><th>Category</th>
            <th style="text-align:right">Amount</th>
            <th>Date</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Filter handler ───────────────────────────────────────────
function setFilter(status, containerId, expenses) {
  currentFilter = status;
  renderExpensesTable(expenses, containerId, { showSubmitter: containerId !== "my-expenses-container" });
}

// ─── View expense detail ──────────────────────────────────────
async function viewExpense(id) {
  try {
    const exp = await API.expenses.get(id);
    renderExpenseDetail(exp);
    openModal("expense-detail-modal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderExpenseDetail(exp) {
  const user = window.currentUser;
  const company = window.currentCompany;
  const currentStep = exp.approvalSteps?.[exp.currentStep];
  const canApprove = (user.role === "admin") ||
    (currentStep?.approverId === user.id && currentStep?.status === "pending" &&
     ["pending", "in_review"].includes(exp.status));

  const detailGrid = `
    <div class="detail-grid">
      <div class="detail-cell">
        <div class="detail-cell-label">Submitted By</div>
        <div class="detail-cell-value">${escHtml(exp.submitterName || "Unknown")}</div>
      </div>
      <div class="detail-cell">
        <div class="detail-cell-label">Amount</div>
        <div class="detail-cell-value">
          ${formatCurrency(exp.amountInCompanyCurrency, company?.currency)}
          ${exp.currency !== company?.currency ? `<span class="amount-cc">${formatCurrency(exp.amount, exp.currency)}</span>` : ""}
        </div>
      </div>
      <div class="detail-cell">
        <div class="detail-cell-label">Category</div>
        <div class="detail-cell-value">${exp.category}</div>
      </div>
      <div class="detail-cell">
        <div class="detail-cell-label">Date</div>
        <div class="detail-cell-value">${formatDate(exp.date)}</div>
      </div>
      <div class="detail-cell" style="grid-column:1/-1">
        <div class="detail-cell-label">Status</div>
        <div class="detail-cell-value">${badge(exp.status)}</div>
      </div>
    </div>
    <div class="detail-cell" style="margin-bottom:20px">
      <div class="detail-cell-label">Description</div>
      <div class="detail-cell-value" style="font-weight:400;margin-top:6px">${escHtml(exp.description)}</div>
    </div>`;

  // Timeline
  let timeline = "";
  if (exp.approvalSteps?.length > 0) {
    const steps = exp.approvalSteps.map((step, i) => {
      const dotClass = `dot-${step.status}`;
      const icon = step.status === "approved" ? "✓" : step.status === "rejected" ? "✕" : (i + 1);
      const isLast = i === exp.approvalSteps.length - 1;
      return `
        <div class="timeline-step">
          <div class="timeline-node">
            <div class="timeline-dot ${dotClass}">${icon}</div>
            ${!isLast ? '<div class="timeline-line"></div>' : ""}
          </div>
          <div class="timeline-info">
            <div class="timeline-name">${escHtml(step.approverName)}</div>
            <div class="timeline-status">${capitalize(step.status === "in_review" ? "In Review" : step.status)}</div>
            ${step.comments ? `<div class="timeline-comment">"${escHtml(step.comments)}"</div>` : ""}
          </div>
        </div>`;
    }).join("");
    timeline = `<div class="approval-timeline"><div class="timeline-title">Approval Progress</div>${steps}</div>`;
  }

  // Approve/reject actions
  let actions = "";
  if (canApprove) {
    actions = `
      <div class="approve-actions">
        <div class="field"><label>Comment (optional)</label><textarea id="approval-comment" placeholder="Add a comment..."></textarea></div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-danger" onclick="doApproval('${exp.id}','reject')">✕ Reject</button>
          <button class="btn btn-success" onclick="doApproval('${exp.id}','approve')">✓ Approve</button>
        </div>
      </div>`;
  }

  document.getElementById("expense-detail-body").innerHTML = detailGrid + timeline + actions;
}

// ─── Process approval ─────────────────────────────────────────
async function doApproval(expenseId, action) {
  const comment = document.getElementById("approval-comment")?.value || "";
  try {
    await API.approvals.action(expenseId, { action, comment });
    closeModal("expense-detail-modal");
    showToast(`Expense ${action === "approve" ? "approved" : "rejected"} successfully.`, action === "approve" ? "success" : "info");
    refreshCurrentSection();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ─── Load sections ────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [expenses, stats] = await Promise.all([
      API.expenses.list(),
      API.approvals.stats().catch(() => null),
    ]);

    // Greeting
    const hr = new Date().getHours();
    const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("dash-greeting").textContent = `${greet}, ${window.currentUser.name.split(" ")[0]} 👋`;

    // Stats
    const company = window.currentCompany;
    const myExpenses = expenses.filter(e => window.currentUser.role === "employee" ? e.userId === window.currentUser.id : true);
    const approved = myExpenses.filter(e => e.status === "approved");
    const totalApproved = approved.reduce((s, e) => s + (e.amountInCompanyCurrency || 0), 0);

    document.getElementById("stats-grid").innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-label">Total Approved</div>
        <div class="stat-value" style="color:var(--green)">${formatCurrency(totalApproved, company?.currency)}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏳</div>
        <div class="stat-label">Pending</div>
        <div class="stat-value" style="color:var(--yellow)">${myExpenses.filter(e => e.status === "pending" || e.status === "in_review").length}</div>
        <div class="stat-sub">Awaiting action</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">❌</div>
        <div class="stat-label">Rejected</div>
        <div class="stat-value" style="color:var(--red)">${myExpenses.filter(e => e.status === "rejected").length}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔔</div>
        <div class="stat-label">Needs My Review</div>
        <div class="stat-value" style="color:var(--primary)">${stats?.pendingForMe || 0}</div>
        <div class="stat-sub">Awaiting your approval</div>
      </div>`;

    // Pending for me (managers/admin)
    if (window.currentUser.role !== "employee") {
      const pendingMine = await API.expenses.pendingMine();
      const pendingSection = document.getElementById("pending-approvals-section");
      if (pendingMine.length > 0) {
        pendingSection.style.display = "block";
        renderExpensesTable(pendingMine, "pending-table-container", { showSubmitter: true });
      } else {
        pendingSection.style.display = "none";
      }
    }

    // Main table
    document.getElementById("expenses-table-title").textContent =
      window.currentUser.role === "admin" ? "All Company Expenses" : "Recent Expenses";
    if (window.currentUser.role === "employee") {
      document.getElementById("new-expense-btn").style.display = "inline-flex";
    }
    renderExpensesTable(expenses, "main-expenses-container", { showSubmitter: window.currentUser.role !== "employee" });
  } catch (err) {
    console.error("Dashboard error:", err);
    showToast("Failed to load dashboard.", "error");
  }
}

async function loadMyExpenses() {
  try {
    const expenses = await API.expenses.list();
    const mine = expenses.filter(e => e.userId === window.currentUser.id);
    renderExpensesTable(mine, "my-expenses-container", { showSubmitter: false });
  } catch (err) {
    showToast("Failed to load expenses.", "error");
  }
}

async function loadApprovals() {
  try {
    const expenses = await API.expenses.list();
    renderExpensesTable(expenses, "approvals-container", { showSubmitter: true });
  } catch (err) {
    showToast("Failed to load approvals.", "error");
  }
}
