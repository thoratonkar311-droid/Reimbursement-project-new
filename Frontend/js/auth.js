/**
 * js/auth.js
 * Authentication: login, signup, session management
 */

let authMode = "login";

function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  const isSignup = authMode === "signup";
  document.getElementById("signup-fields").style.display = isSignup ? "block" : "none";
  document.getElementById("auth-title").textContent = isSignup ? "Set up your workspace" : "Welcome back";
  document.getElementById("auth-subtitle").textContent = isSignup ? "Create company & admin account" : "Sign in to your account";
  document.getElementById("auth-btn").textContent = isSignup ? "Create Workspace" : "Sign In";
  document.getElementById("auth-switch-text").textContent = isSignup ? "Already have one? " : "No account? ";
  document.getElementById("auth-switch-btn").textContent = isSignup ? "Sign in" : "Sign up";
  document.getElementById("auth-error").style.display = "none";
}

async function handleAuth() {
  const btn = document.getElementById("auth-btn");
  const errEl = document.getElementById("auth-error");
  errEl.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Please wait...";

  try {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    let data;
    if (authMode === "login") {
      data = await API.auth.login({ email, password });
    } else {
      const name = document.getElementById("auth-name").value.trim();
      const companyName = document.getElementById("auth-company").value.trim();
      const country = document.getElementById("auth-country").value;
      if (!name || !companyName || !country) throw new Error("All fields are required.");
      data = await API.auth.signup({ name, email, password, companyName, country });
    }

    localStorage.setItem("token", data.token);
    window.currentUser = data.user;
    window.currentCompany = data.company;
    initApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === "login" ? "Sign In" : "Create Workspace";
  }
}

function logout() {
  localStorage.removeItem("token");
  window.currentUser = null;
  window.currentCompany = null;
  document.getElementById("auth-page").style.display = "";
  document.getElementById("auth-page").classList.add("active");
  document.getElementById("main-page").style.display = "none";
}

async function checkSession() {
  const token = localStorage.getItem("token");
  if (!token) return false;
  try {
    const data = await API.auth.me();
    window.currentUser = data.user;
    window.currentCompany = data.company;
    return true;
  } catch {
    localStorage.removeItem("token");
    return false;
  }
}

// Load countries into signup select
async function loadCountries() {
  try {
    const countries = await API.currency.countries();
    const sel = document.getElementById("auth-country");
    sel.innerHTML = countries.map(c => `<option value="${c.name}">${c.name} (${c.currency})</option>`).join("");
    // Default to United States
    const usOption = [...sel.options].find(o => o.value === "United States");
    if (usOption) sel.value = "United States";
  } catch {
    // fallback
    document.getElementById("auth-country").innerHTML = `
      <option value="United States">United States (USD)</option>
      <option value="India">India (INR)</option>
      <option value="United Kingdom">United Kingdom (GBP)</option>
    `;
  }
}

loadCountries();
