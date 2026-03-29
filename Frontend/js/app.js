/**
 * js/app.js
 * Main application: init, navigation, routing, session restore
 */

let currentSection = "dashboard";

// ─── Nav config ───────────────────────────────────────────────
function getNavItems(role) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
  ];
  if (role !== "employee") {
    items.push({ id: "approvals", label: "Approvals", icon: "✅", hasBadge: true });
  }
  items.push({ id: "expenses", label: "My Expenses", icon: "💳" });
  if (role === "admin") {
    items.push({ id: "users", label: "Team", icon: "👥" });
    items.push({ id: "flows", label: "Approval Flows", icon: "🔗" });
  }
  return items;
}

// ─── Render sidebar nav ───────────────────────────────────────
async function renderNav() {
  const role = window.currentUser.role;
  const items = getNavItems(role);

  // Get badge count
  let pendingCount = 0;
  try {
    const stats = await API.approvals.stats();
    pendingCount = stats.pendingForMe || 0;
  } catch {}

  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = items.map(item => `
    <button class="nav-item ${currentSection === item.id ? "active" : ""}"
      onclick="navigateTo('${item.id}')" id="nav-${item.id}">
      <span class="nav-icon">${item.icon}</span>
      ${item.label}
      ${item.hasBadge && pendingCount > 0
        ? `<span class="nav-badge" id="nav-badge-approvals">${pendingCount}</span>` : ""}
    </button>`).join("");
}

// ─── Navigate to section ──────────────────────────────────────
function navigateTo(sectionId) {
  currentSection = sectionId;

  // Hide all sections
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));

  // Show target
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add("active");

  // Update nav active state
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.id === `nav-${sectionId}`);
  });

  // Load section data
  loadSection(sectionId);
}

function loadSection(id) {
  switch (id) {
    case "dashboard": loadDashboard(); break;
    case "approvals": loadApprovals(); break;
    case "expenses":  initExpenseForm(); loadMyExpenses(); break;
    case "users":     loadUsers(); break;
    case "flows":     loadFlows(); break;
  }
}

function refreshCurrentSection() {
  loadSection(currentSection);
  renderNav(); // refresh badge count
}

// ─── Init app after auth ──────────────────────────────────────
async function initApp() {
  const user = window.currentUser;
  const company = window.currentCompany;

  // Switch pages
  document.getElementById("auth-page").style.display = "none";
  document.getElementById("main-page").style.display = "flex";

  // Populate sidebar user info
  const avatarColors = { admin: "#4f6ef7", manager: "#3dbf6e", employee: "#5a6280" };
  document.getElementById("sidebar-avatar").textContent = user.name[0].toUpperCase();
  document.getElementById("sidebar-avatar").style.background = avatarColors[user.role] || "#5a6280";
  document.getElementById("sidebar-name").textContent = user.name;
  document.getElementById("sidebar-role").textContent = user.role.toUpperCase();
  document.getElementById("sidebar-company").textContent = company?.name || "—";

  // Render nav
  await renderNav();

  // Load dashboard
  navigateTo("dashboard");
}

// ─── On page load: check session ─────────────────────────────
(async function () {
  const loggedIn = await checkSession();
  if (loggedIn) {
    await initApp();
  }
})();
