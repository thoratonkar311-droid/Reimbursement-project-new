/**
 * routes/currency.js
 * Currency info and live conversion
 */

const router = require("express").Router();
const axios = require("axios");
const { authenticate } = require("../middleware/auth");
const { getExchangeRates, convert } = require("../utils/currency");

// ─── GET /api/currency/countries ─────────────────────────────
router.get("/countries", async (req, res) => {
  try {
    const { data } = await axios.get("https://restcountries.com/v3.1/all?fields=name,currencies", { timeout: 8000 });
    const list = data
      .map(c => ({
        name: c.name?.common,
        currency: Object.keys(c.currencies || {})[0] || null,
        symbol: Object.values(c.currencies || {})[0]?.symbol || null,
        currencyName: Object.values(c.currencies || {})[0]?.name || null,
      }))
      .filter(c => c.name && c.currency)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (err) {
    res.status(503).json({ error: "Could not fetch country data.", fallback: [
      { name: "United States", currency: "USD", symbol: "$" },
      { name: "India", currency: "INR", symbol: "₹" },
      { name: "United Kingdom", currency: "GBP", symbol: "£" },
      { name: "European Union", currency: "EUR", symbol: "€" },
    ]});
  }
});

// ─── GET /api/currency/rates/:base ───────────────────────────
router.get("/rates/:base", async (req, res) => {
  try {
    const rates = await getExchangeRates(req.params.base.toUpperCase());
    res.json({ base: req.params.base.toUpperCase(), rates });
  } catch (err) {
    res.status(503).json({ error: "Could not fetch exchange rates." });
  }
});

// ─── POST /api/currency/convert ──────────────────────────────
router.post("/convert", authenticate, async (req, res) => {
  try {
    const { amount, from, to } = req.body;
    if (!amount || !from || !to) return res.status(400).json({ error: "amount, from, to required." });
    const converted = await convert(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
    res.json({ amount: parseFloat(amount), from, to, converted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
