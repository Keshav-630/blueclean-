const express = require("express");
const multer = require("multer");
const path = require("path");
const Report = require("../models/Report");
const { calculateSeverity, severityBand } = require("../utils/severity");
const { optionalAuth, requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

router.get("/", async (req, res) => {
  try {
    const { pollutionType, status, severityBand, q } = req.query;
    const query = {};

    if (pollutionType && pollutionType !== "all") {
      query.pollutionType = pollutionType;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (severityBand && severityBand !== "all") {
      query.severityBand = severityBand;
    }

    if (q) {
      query.$or = [
        { description: { $regex: q, $options: "i" } },
        { pollutionType: { $regex: q, $options: "i" } },
        { reporterName: { $regex: q, $options: "i" } }
      ];
    }

    const reports = await Report.find(query).sort({ createdAt: -1 }).limit(500);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reports." });
  }
});

router.get("/stats/overview", async (req, res) => {
  try {
    const [total, high, medium, low, open] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ severityBand: "high" }),
      Report.countDocuments({ severityBand: "medium" }),
      Report.countDocuments({ severityBand: "low" }),
      Report.countDocuments({ status: { $ne: "resolved" } })
    ]);

    res.json({ total, high, medium, low, open });
  } catch (error) {
    res.status(500).json({ message: "Failed to load stats." });
  }
});

router.post("/", optionalAuth, upload.single("photo"), async (req, res) => {
  try {
    const { pollutionType, description, lat, lng, reporterName } = req.body;

    if (!pollutionType || !description || !lat || !lng) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const numericLat = Number(lat);
    const numericLng = Number(lng);

    if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) {
      return res.status(400).json({ message: "Invalid coordinates." });
    }

    const score = calculateSeverity(pollutionType, description);
    const band = severityBand(score);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

    const created = await Report.create({
      pollutionType,
      description,
      location: {
        type: "Point",
        coordinates: [numericLng, numericLat]
      },
      severityScore: score,
      severityBand: band,
      imageUrl,
      reporterName: req.user?.name || reporterName || "Anonymous",
      reporterUser: req.user?._id || null
    });

    req.app.get("io").emit("report:created", created);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create report." });
  }
});

router.patch("/:id/status", requireAuth, requireRole("authority", "ngo", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["reported", "verified", "cleaning", "resolved"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const updated = await Report.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) return res.status(404).json({ message: "Report not found." });

    req.app.get("io").emit("report:updated", updated);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update status." });
  }
});

module.exports = router;
