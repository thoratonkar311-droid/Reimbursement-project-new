/**
 * js/ui.js
 * Shared UI utilities: modals, toasts, formatting, helpers
 */

// ─── Modals ───────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("open"); el.style.display = "flex"; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove("open"); el.style.display = "none"; }
}

function handleOverlayClick(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

// ─── Toast notifications ──────────────────────────────────────
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transition = "opacity 0.3s"; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ─── OCR ─────────────────────────────────────────────────────
let ocrFileData = null;

function previewReceipt(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    ocrFileData = { base64: ev.target.result, mediaType: file.type };
    const dz = document.getElementById("ocr-dropzone");
    dz.innerHTML = `<img src="${ev.target.result}" style="max-height:180px;max-width:100%;border-radius:8px" />`;
    document.getElementById("ocr-result").style.display = "none";
    document.getElementById("ocr-use-btn").style.display = "none";
    document.getElementById("ocr-error").style.display = "none";
  };
  reader.readAsDataURL(file);
}

async function scanReceipt() {
  if (!ocrFileData) return showToast("Please upload a receipt image first.", "error");
  const btn = document.getElementById("ocr-scan-btn");
  btn.disabled = true; btn.textContent = "⏳ Scanning...";

  try {
    const result = await API.ocr.scanBase64({ image: ocrFileData.base64, mediaType: ocrFileData.mediaType });
    const data = result.data;
    window._ocrResult = data;

    const rows = Object.entries(data)
      .filter(([k, v]) => v && k !== "items")
      .map(([k, v]) => `<div class="ocr-row"><div class="ocr-key">${k}</div><div class="ocr-val">${String(v)}</div></div>`)
      .join("");
    const itemsRow = data.items?.length
      ? `<div class="ocr-row"><div class="ocr-key">items</div><div class="ocr-val">${data.items.join(", ")}</div></div>` : "";

    const resultEl = document.getElementById("ocr-result");
    resultEl.innerHTML = `<div class="ocr-result-title">✅ Extracted successfully</div>${rows}${itemsRow}`;
    resultEl.style.display = "block";
    document.getElementById("ocr-use-btn").style.display = "inline-flex";
    document.getElementById("ocr-error").style.display = "none";
  } catch (err) {
    const errEl = document.getElementById("ocr-error");
    errEl.textContent = err.message || "OCR failed. Please fill the form manually.";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false; btn.textContent = "Scan Receipt";
  }
}

function useOcrData() {
  const data = window._ocrResult;
  if (!data) return;

  if (data.amount) document.getElementById("exp-amount").value = data.amount;
  if (data.category) document.getElementById("exp-category").value = data.category;
  if (data.date) document.getElementById("exp-date").value = data.date;
  if (data.currency) {
    const sel = document.getElementById("exp-currency");
    const opt = [...sel.options].find(o => o.value === data.currency);
    if (opt) sel.value = data.currency;
  }
  if (data.description || data.merchant) {
    document.getElementById("exp-desc").value =
      [data.merchant, data.description].filter(Boolean).join(" — ");
  }

  closeModal("ocr-modal");
  openModal("submit-expense-modal");
  triggerConvert();
  showToast("Receipt data loaded into form!", "success");

  // Reset OCR state
  ocrFileData = null;
  window._ocrResult = null;
  document.getElementById("ocr-dropzone").innerHTML = `
    <div class="dropzone-content">
      <div class="dropzone-icon">📄</div>
      <p>Click to upload receipt (JPG, PNG)</p>
    </div>`;
  document.getElementById("ocr-result").style.display = "none";
  document.getElementById("ocr-use-btn").style.display = "none";
}

// ─── Formatting ───────────────────────────────────────────────
function formatCurrency(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function badge(status) {
  const labels = { pending: "Pending", in_review: "In Review", approved: "Approved", rejected: "Rejected", draft: "Draft" };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
