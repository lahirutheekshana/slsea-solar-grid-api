import express from "express";
import mongoose from "mongoose";
import SoloInstallation from "../models/SolarInstallation.js";
import GenerationReading from "../models/GenerationReading.js";

const router = express.Router();

// GET /installations
router.get("/", async (req, res) => {
  try {
    const installations = await SoloInstallation.find();
    res.json(installations);
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});

// GET /installations/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let installation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      installation = await SoloInstallation.findById(id);
    }

    if (!installation) {
      installation = await SoloInstallation.findOne({
        $or: [
          { installation_id: { $regex: new RegExp(`^${id}$`, "i") } },
          { code: { $regex: new RegExp(`^${id}$`, "i") } },
        ],
      });
    }

    if (!installation) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Installation not found",
      });
    }
    res.status(200).json(installation);
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});

//get/installation/:id/composite
router.get("/:id/composite", async (req, res) => {
  try {
    const { id } = req.params;
    let installation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      installation = await SoloInstallation.findById(id);
    }

    if (!installation) {
      installation = await SoloInstallation.findOne({
        $or: [
          { installation_id: { $regex: new RegExp(`^${id}$`, "i") } },
          { code: { $regex: new RegExp(`^${id}$`, "i") } },
        ],
      });
    }

    if (!installation) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Installation not found",
      });
    }

    const instId = installation.installation_id || installation._id;

    const latestReading = await GenerationReading.findOne({
      $or: [{ installation_id: instId }, { installation_id: installation._id }],
    }).sort({ timestamp: -1 });

    const summary = await GenerationReading.aggregate([
      {
        $match: {
          $or: [
            { installation_id: String(instId) },
            { installation_id: String(installation._id) },
          ],
        },
      },
      {
        $group: {
          _id: "null",
          total_readings: { $sum: 1 },
          max_instantaneous_kw: { $max: "$instantaneous_kw" },
          latest_cumulative_kwh: { $last: "$cumulative_kwh" },
        },
      },
    ]);

    const analyticsData =
      summary.length > 0
        ? summary[0]
        : {
            total_readings: 0,
            max_instantaneous_kw: 0,
            latest_cumulative_kwh: 0,
          };

    res.status(200).json({
      installation: installation,
      latest_reading: latestReading || null,
      analytis: {
        total_readings_count: analyticsData.total_readings,
        max_instantaneous_kw: analyticsData.max_instantaneous_kw,
        latest_cumulative_kwh: analyticsData.latest_cumulative_kwh,
      },
    });
  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: error.message,
    });
  }
});

// GET /installations/:id/last-reading
router.get("/:id/last-reading", async (req, res) => {
  try {
    const { id } = req.params;
    let installation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      installation = await SoloInstallation.findById(id);
    }

    if (!installation) {
      installation = await SoloInstallation.findOne({
        $or: [
          { installation_id: { $regex: new RegExp(`^${id}$`, "i") } },
          { code: { $regex: new RegExp(`^${id}$`, "i") } },
        ],
      });
    }

    if (!installation) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Installation not found",
      });
    }

    const instId = installation.installation_id || installation._id;

    const latestReading = await GenerationReading.findOne({
      $or: [
        { installation_id: String(instId) },
        { installation_id: String(installation._id) }
      ],
    }).sort({ timestamp: -1 });

    res.status(200).json(latestReading );

  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: error.message,
    });
  }
});

// GET /installations/:id/readings
router.get("/:id/readings", async (req, res) => {
  try {
    const { id } = req.params;
    let installation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      installation = await SoloInstallation.findById(id);
    }

    if (!installation) {
      installation = await SoloInstallation.findOne({
        $or: [
          { installation_id: { $regex: new RegExp(`^${id}$`, "i") } },
          { code: { $regex: new RegExp(`^${id}$`, "i") } },
        ],
      });
    }

    if (!installation) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Installation not found",
      });
    }

    const instId = installation.installation_id || installation._id;

    const readings = await GenerationReading.find({
      $or: [
        { installation_id: String(instId) },
        { installation_id: String(installation._id) }
      ],
    }).sort({ timestamp: -1});

    if(!readings || readings.length === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "No readings found for this installation",
      });
    }

    res.status(200).json(readings);
  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: error.message,
    });
  }
});

export default router;
