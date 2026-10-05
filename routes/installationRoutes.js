import express from "express";
import mongoose from "mongoose";
import SoloInstallation from "../models/SolarInstallation.js";

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

export default router;
