/**
 * js/users.js
 * Team management: list, create, update role/manager, delete
 */

let addUserVisible = false;

function toggleAddUser() {
  addUserVisible = !addUserVisible;
  document.getElementById("add-user-form").style.display = addUserVisible ? "block" : "none";
  if (addUserVisible) loadManagerOptions();
}

function toggleManagerField() {
  const role = document.getElementById("new-user-role").value;
  document.getElementById("manager-field").style.display = role === "employee" ? "block" : "none";
}

async function loadManagerOptions() {
  try {
    const managers = await API.users.managers();
    const sel = document.getElementById("new-user-manager");
    sel.innerHTML = `<option value="">No manager</option>` +
      managers.map(m => `<option value="${m.id}">${escHtml(m.name)} (${m.role})</option>`).join("");
  } catch {}
}

async function createUser() {
  const name = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const role = document.getElementById("new-user-role").value;
  const managerId = document.getElementById("new-user-manager").value;

  if (!name || !email) return showToast("Name and email are required.", "error");

  try {
    await API.users.create({ name, email, role, managerId: managerId || null });
    showToast("User created successfully.", "success");
    document.getElementById("new-user-name").value = "";
    document.getElementById("new-user-email").value = "";
    toggleAddUser();
    loadUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadUsers() {
  try {
    const [users, managers] = await Promise.all([
      API.users.list(),
      API.users.managers(),
    ]);
    renderUsersList(users, managers);
  } catch (err) {
    showToast("Failed to load users.", "error");
  }
}

function renderUsersList(users, managers) {
  const container = document.getElementById("users-list");
  if (!users.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>No team members yet. Add your first user above.</p></div>`;
    return;
  }

  const roleColors = { admin: "#4f6ef7", manager: "#3dbf6e", employee: "#5a6280" };

  container.innerHTML = users.map(u => {
    const avatarColor = roleColors[u.role] || "#5a6280";
    const managerOptions = managers
      .filter(m => m.id !== u.id)
      .map(m => `<option value="${m.id}" ${u.managerId === m.id ? "selected" : ""}>${escHtml(m.name)}</option>`)
      .join("");
    const myManager = managers.find(m => m.id === u.managerId);

    return `
      <div class="user-row" id="user-row-${u.id}">
        <div class="user-row-avatar" style="background:${avatarColor}">${u.name[0].toUpperCase()}</div>
        <div class="user-row-info">
          <div class="user-row-name">${escHtml(u.name)}</div>
          <div class="user-row-email">${escHtml(u.email)}${myManager ? ` · Manager: ${escHtml(myManager.name)}` : ""}</div>
        </div>
        <div class="user-row-actions">
          <select class="btn btn-ghost btn-sm" style="padding:6px 10px;width:auto"
            onchange="updateUserRole('${u.id}', this.value)">
            <option value="employee" ${u.role === "employee" ? "selected" : ""}>Employee</option>
            <option value="manager" ${u.role === "manager" ? "selected" : ""}>Manager</option>
          </select>
          ${u.role === "employee" ? `
          <select class="btn btn-ghost btn-sm" style="padding:6px 10px;width:auto"
            onchange="updateUserManager('${u.id}', this.value)">
            <option value="">No manager</option>
            ${managerOptions}
          </select>` : ""}
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteUser('${u.id}', '${escHtml(u.name)}')">✕</button>
        </div>
      </div>`;
  }).join("");
}

async function updateUserRole(userId, role) {
  try {
    await API.users.update(userId, { role });
    showToast("Role updated.", "success");
    loadUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function updateUserManager(userId, managerId) {
  try {
    await API.users.update(userId, { managerId: managerId || null });
    showToast("Manager updated.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteUser(userId, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await API.users.remove(userId);
    showToast("User deleted.", "info");
    loadUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}
