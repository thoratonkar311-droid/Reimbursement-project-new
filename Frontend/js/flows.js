/**
 * js/flows.js
 * Approval flow builder: multi-step config + conditional rules
 */

let flowSteps = [];
let allManagers = [];

async function loadFlows() {
  try {
    const [flow, managers] = await Promise.all([
      API.company.getFlow(),
      API.users.list(),
    ]);
    allManagers = managers.filter(u => u.role === "manager" || u.role === "admin");
    renderFlowEditor(flow);
  } catch (err) {
    showToast("Failed to load approval flow.", "error");
  }
}

function renderFlowEditor(flow) {
  flowSteps = flow?.steps ? [...flow.steps] : [];
  const rule = flow?.rule || { type: "sequential" };
  const container = document.getElementById("flow-editor-container");

  const managerOptions = allManagers.map(m =>
    `<option value="${m.id}" data-name="${escHtml(m.name)}" data-role="${m.role}">${escHtml(m.name)} (${m.role})</option>`
  ).join("");

  container.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <h3>🔗 Approval Steps</h3>
        <button class="btn btn-primary btn-sm" onclick="addFlowStep()">+ Add Step</button>
      </div>
      <p style="color:var(--text-3);font-size:13px;margin-bottom:16px">
        Expenses move through these steps in order. Each step must complete before the next begins.
      </p>
      <div id="flow-steps-list">
        ${flowSteps.length === 0 ? renderEmptySteps() : flowSteps.map((s, i) => renderStep(s, i, managerOptions)).join("")}
      </div>
      <div style="display:hidden" id="managers-options-store" style="display:none">${managerOptions}</div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>⚡ Conditional Rule</h3></div>
      <p style="color:var(--text-3);font-size:13px;margin-bottom:16px">
        Define when an expense is auto-approved without going through all steps.
      </p>
      <div class="field">
        <label>Rule Type</label>
        <select id="flow-rule-type" onchange="onRuleTypeChange()">
          <option value="sequential" ${rule.type === "sequential" ? "selected" : ""}>Sequential — All approvers must approve in order</option>
          <option value="percentage" ${rule.type === "percentage" ? "selected" : ""}>Percentage — e.g. 60% of approvers approve</option>
          <option value="specific"   ${rule.type === "specific"   ? "selected" : ""}>Specific Approver — e.g. CFO approval = auto-approved</option>
          <option value="hybrid"     ${rule.type === "hybrid"     ? "selected" : ""}>Hybrid — Percentage OR Specific approver</option>
        </select>
      </div>
      <div id="pct-field" style="display:${["percentage","hybrid"].includes(rule.type) ? "block" : "none"}">
        <div class="field">
          <label>Approval Threshold: <span id="pct-label">${rule.percentage || 60}%</span></label>
          <input type="range" min="1" max="100" value="${rule.percentage || 60}" id="flow-pct"
            oninput="document.getElementById('pct-label').textContent=this.value+'%'"
            style="width:100%;accent-color:var(--primary)" />
        </div>
      </div>
      <div id="specific-field" style="display:${["specific","hybrid"].includes(rule.type) ? "block" : "none"}">
        <div class="field">
          <label>Key Approver (their approval = auto-approve)</label>
          <select id="flow-specific">
            <option value="">Select approver</option>
            ${allManagers.map(m => `<option value="${m.id}" ${rule.specificApproverId === m.id ? "selected" : ""}>${escHtml(m.name)} (${m.role})</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="loadFlows()">Reset</button>
      <button class="btn btn-primary" onclick="saveFlow()">💾 Save Flow</button>
    </div>`;
}

function renderEmptySteps() {
  return `<div class="flow-empty" id="empty-steps-msg">
    <div style="font-size:36px;margin-bottom:12px">🔗</div>
    <p style="color:var(--text-3)">No steps yet. Add the first approval step above.</p>
  </div>`;
}

function renderStep(step, i, managerOptions) {
  const opts = managerOptions || document.getElementById("managers-options-store")?.innerHTML || "";
  return `
    <div class="flow-step" id="flow-step-${i}">
      <div class="flow-step-num">${i + 1}</div>
      <div class="flow-step-body">
        <select onchange="updateStepApprover(${i}, this)">
          ${allManagers.map(m => `<option value="${m.id}" data-name="${escHtml(m.name)}" data-role="${m.role}" ${step.approverId === m.id ? "selected" : ""}>${escHtml(m.name)} (${m.role})</option>`).join("")}
        </select>
        <label style="display:flex;align-items:center;gap:8px;color:var(--text-2);font-size:13px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" ${step.isManagerApprover ? "checked" : ""} onchange="updateStepFlag(${i}, this.checked)" />
          Is Manager Approver
        </label>
      </div>
      <button onclick="removeStep(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:4px">✕</button>
    </div>`;
}

function addFlowStep() {
  const firstManager = allManagers[0];
  if (!firstManager) return showToast("Add managers to your team first.", "error");
  flowSteps.push({
    approverId: firstManager.id,
    approverName: firstManager.name,
    role: firstManager.role,
    isManagerApprover: false,
  });
  reRenderSteps();
}

function removeStep(i) {
  flowSteps.splice(i, 1);
  reRenderSteps();
}

function updateStepApprover(i, select) {
  const opt = select.options[select.selectedIndex];
  flowSteps[i].approverId = select.value;
  flowSteps[i].approverName = opt.dataset.name || opt.text;
  flowSteps[i].role = opt.dataset.role || "manager";
}

function updateStepFlag(i, checked) {
  flowSteps[i].isManagerApprover = checked;
}

function reRenderSteps() {
  const list = document.getElementById("flow-steps-list");
  if (!list) return;
  if (!flowSteps.length) { list.innerHTML = renderEmptySteps(); return; }
  list.innerHTML = flowSteps.map((s, i) => renderStep(s, i)).join("");
}

function onRuleTypeChange() {
  const type = document.getElementById("flow-rule-type").value;
  document.getElementById("pct-field").style.display = ["percentage","hybrid"].includes(type) ? "block" : "none";
  document.getElementById("specific-field").style.display = ["specific","hybrid"].includes(type) ? "block" : "none";
}

async function saveFlow() {
  const ruleType = document.getElementById("flow-rule-type").value;
  const percentage = parseInt(document.getElementById("flow-pct")?.value || 60);
  const specificApproverId = document.getElementById("flow-specific")?.value || null;

  const rule = { type: ruleType };
  if (["percentage","hybrid"].includes(ruleType)) rule.percentage = percentage;
  if (["specific","hybrid"].includes(ruleType)) rule.specificApproverId = specificApproverId;

  try {
    await API.company.saveFlow({ steps: flowSteps, rule });
    showToast("Approval flow saved!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}
