/**
 * dataStore.js
 * Simple JSON file-based data store (no external DB required)
 * Replace with a real DB (MongoDB/PostgreSQL) for production
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../../data");

const FILES = {
  companies: path.join(DATA_DIR, "companies.json"),
  users:     path.join(DATA_DIR, "users.json"),
  expenses:  path.join(DATA_DIR, "expenses.json"),
  flows:     path.join(DATA_DIR, "flows.json"),
};

// ─── Init ─────────────────────────────────────────────────────
function initDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  Object.values(FILES).forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify([]), "utf8");
  });
  console.log("✅ Data store initialized at:", DATA_DIR);
}

// ─── Read / Write ─────────────────────────────────────────────
function readAll(collection) {
  try {
    const raw = fs.readFileSync(FILES[collection], "utf8");
    return JSON.parse(raw);
  } catch { return []; }
}

function writeAll(collection, data) {
  fs.writeFileSync(FILES[collection], JSON.stringify(data, null, 2), "utf8");
}

// ─── CRUD helpers ─────────────────────────────────────────────
function findAll(collection, filter = {}) {
  const data = readAll(collection);
  return data.filter(item => Object.keys(filter).every(k => item[k] === filter[k]));
}

function findOne(collection, filter) {
  const data = readAll(collection);
  return data.find(item => Object.keys(filter).every(k => item[k] === filter[k])) || null;
}

function findById(collection, id) {
  return findOne(collection, { id });
}

function insert(collection, doc) {
  const data = readAll(collection);
  data.push(doc);
  writeAll(collection, data);
  return doc;
}

function updateById(collection, id, updates) {
  const data = readAll(collection);
  const idx = data.findIndex(item => item.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates, updatedAt: Date.now() };
  writeAll(collection, data);
  return data[idx];
}

function deleteById(collection, id) {
  const data = readAll(collection);
  const filtered = data.filter(item => item.id !== id);
  writeAll(collection, filtered);
  return filtered.length < data.length;
}

module.exports = {
  initDataStore,
  findAll,
  findOne,
  findById,
  insert,
  updateById,
  deleteById,
  readAll,
  writeAll,
};
