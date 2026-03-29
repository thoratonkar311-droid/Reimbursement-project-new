/**
 * routes/auth.js
 * Authentication: signup (auto-creates company+admin), login
 */

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { findOne, insert } = require("../utils/dataStore");
const { generateToken } = require("../middleware/auth");
const axios = require("axios");

// ─── POST /api/auth/signup ────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, companyName, country } = req.body;

    if (!name || !email || !password || !companyName || !country) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Check duplicate email
    const existing = findOne("users", { email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered." });

    // Fetch country currency info
    let currency = "USD";
    let currencySymbol = "$";
    let currencyName = "US Dollar";
    try {
      const { data } = await axios.get("https://restcountries.com/v3.1/all?fields=name,currencies", { timeout: 5000 });
      const countryData = data.find(c => c.name?.common?.toLowerCase() === country.toLowerCase());
      if (countryData?.currencies) {
        const code = Object.keys(countryData.currencies)[0];
        currency = code;
        currencySymbol = countryData.currencies[code]?.symbol || code;
        currencyName = countryData.currencies[code]?.name || code;
      }
    } catch { /* use defaults */ }

    // Create company
    const companyId = uuidv4();
    const company = {
      id: companyId,
      name: companyName,
      country,
      currency,
      currencySymbol,
      currencyName,
      createdAt: Date.now(),
    };
    insert("companies", company);

    // Create admin user
    const hashedPwd = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const user = {
      id: userId,
      companyId,
      name,
      email: email.toLowerCase(),
      password: hashedPwd,
      role: "admin",
      managerId: null,
      createdAt: Date.now(),
    };
    insert("users", user);

    // Create default approval flow for company
    const flowId = uuidv4();
    const defaultFlow = {
      id: flowId,
      companyId,
      steps: [],
      rule: { type: "sequential" },
      createdAt: Date.now(),
    };
    insert("flows", defaultFlow);

    const token = generateToken(userId);
    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser, company });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required." });

    const user = findOne("users", { email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const { findById } = require("../utils/dataStore");
    const company = findById("companies", user.companyId);

    const token = generateToken(user.id);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser, company });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get("/me", require("../middleware/auth").authenticate, (req, res) => {
  const { findById } = require("../utils/dataStore");
  const company = findById("companies", req.user.companyId);
  const { password: _, ...safeUser } = req.user;
  res.json({ user: safeUser, company });
});

module.exports = router;
