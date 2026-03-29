/**
 * currency.js
 * Currency conversion utilities using exchangerate-api.com
 */

const axios = require("axios");

const CACHE = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getExchangeRates(baseCurrency = "USD") {
  const key = baseCurrency.toUpperCase();
  const cached = CACHE[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.rates;

  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${key}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    CACHE[key] = { rates: data.rates, timestamp: Date.now() };
    return data.rates;
  } catch (err) {
    console.error("Currency API error:", err.message);
    // Fallback rates if API fails
    return { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.1, JPY: 149.5 };
  }
}

async function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const rates = await getExchangeRates(fromCurrency);
  const rate = rates[toCurrency];
  if (!rate) throw new Error(`Cannot convert ${fromCurrency} to ${toCurrency}`);
  return parseFloat((amount * rate).toFixed(2));
}

module.exports = { getExchangeRates, convert };
