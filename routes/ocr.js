/**
 * routes/ocr.js
 * AI-powered receipt scanning using Claude Vision
 */

const router = require("express").Router();
const axios = require("axios");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");

// Use memory storage (no disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only images and PDFs allowed."));
  },
});

const OCR_PROMPT = `Analyze this receipt image and extract all expense details.
Return ONLY valid JSON with these fields (no markdown, no explanation):
{
  "amount": <number - total amount>,
  "currency": "<3-letter ISO currency code, default USD>",
  "date": "<YYYY-MM-DD format>",
  "description": "<brief description of the expense>",
  "category": "<one of: Travel|Meals & Entertainment|Accommodation|Office Supplies|Software & Subscriptions|Training & Education|Medical|Utilities|Marketing|Equipment|Fuel|Communication|Other>",
  "merchant": "<merchant/vendor name>",
  "items": ["<line item 1>", "<line item 2>"]
}
If a field cannot be determined, use a reasonable default. Return ONLY the JSON object.`;

// ─── POST /api/ocr/scan ─ scan receipt image ──────────────────
router.post("/scan", authenticate, upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const base64 = req.file.buffer.toString("base64");
    const mediaType = req.file.mimetype;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "OCR service not configured (ANTHROPIC_API_KEY missing)." });

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: OCR_PROMPT },
          ],
        }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        timeout: 30000,
      }
    );

    const text = response.data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error("OCR error:", err.message);
    if (err.message.includes("JSON")) {
      return res.status(422).json({ error: "Could not parse receipt. Please fill fields manually." });
    }
    res.status(500).json({ error: "OCR scan failed. Please try again." });
  }
});

// ─── POST /api/ocr/scan-base64 ─ for frontend direct upload ───
router.post("/scan-base64", authenticate, async (req, res) => {
  try {
    const { image, mediaType = "image/jpeg" } = req.body;
    if (!image) return res.status(400).json({ error: "No image data provided." });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "OCR service not configured." });

    const base64 = image.includes(",") ? image.split(",")[1] : image;

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: OCR_PROMPT },
          ],
        }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        timeout: 30000,
      }
    );

    const text = response.data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ error: "OCR scan failed." });
  }
});

module.exports = router;
