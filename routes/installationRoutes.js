import express from "express";
import mongoose from "mongoose";
import SolarInstallation from "../models/SolarInstallation.js";
import GenerationReading from "../models/GenerationReading.js";
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /installations
router.get("/", async (req, res) => {
  try {
    const installations = await SolarInstallation.find();
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
      installation = await SolarInstallation.findById(id);
    }

    if (!installation) {
      installation = await SolarInstallation.findOne({
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

// GET /installations/:id/composite
router.get("/:id/composite", async (req, res) => {
  try {
    const { id } = req.params;
    let installation = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      installation = await SolarInstallation.findById(id);
    }

    if (!installation) {
      installation = await SolarInstallation.findOne({
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
        $match: {$or: [
            { installation_id: String(instId) },
            { installation_id: String(installation._id) },
          ],
        },
      },
      {
        $group: {
          _id: null,
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
      installation = await SolarInstallation.findById(id);
    }

    if (!installation) {
      installation = await SolarInstallation.findOne({
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

    res.status(200).json(latestReading);

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
      installation = await SolarInstallation.findById(id);
    }

    if (!installation) {
      installation = await SolarInstallation.findOne({
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

// PUT /installations/:id (Full Update)
router.put(
  '/:id',
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split('_')[1]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, owner_name, capacity_kw, grid_substation_code, province_id, district_id } = req.body;

      if (!name || !owner_name || !capacity_kw || !grid_substation_code) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'PUT requires all resource fields (name, owner_name, capacity_kw, grid_substation_code) for a full update.'
        });
      }

      const updatedInstallation = await SolarInstallation.findOneAndUpdate(
        { $or: [{ installation_id: id }, { code: id }] },
        { name, owner_name, capacity_kw, grid_substation_code, province_id, district_id },
        { new: true, runValidators: true }
      );

      if (!updatedInstallation) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `Installation not found with id: ${id}`
        });
      }

      res.status(200).json({
        message: 'Installation fully updated successfully',
        data: updatedInstallation
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to update installation',
        details: error.message
      });
    }
  }
);

// PATCH /installations/:id (Partial Update)
router.patch(
  '/:id',
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split('_')[1]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body; 

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'No update fields provided in request body.'
        });
      }

      const updatedInstallation = await SolarInstallation.findOneAndUpdate(
        { $or: [{ installation_id: id }, { code: id }] },
        { $set: updates }, 
        { new: true, runValidators: true }
      );

      if (!updatedInstallation) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `Installation not found with id: ${id}`
        });
      }

      res.status(200).json({
        message: 'Installation partially updated successfully',
        data: updatedInstallation
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to partially update installation',
        details: error.message
      });
    }
  }
);

// DELETE /installations/:id (Delete Resource)
router.delete(
  '/:id',
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split('_')[1]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const deletedInstallation = await SolarInstallation.findOneAndDelete({
        $or: [{ installation_id: id }, { code: id }]
      });

      if (!deletedInstallation) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `Installation not found with id: ${id}`
        });
      }

      res.status(200).json({
        message: `Installation ${id} deleted successfully`,
        deleted_id: id
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to delete installation',
        details: error.message
      });
    }
  }
);

export default router;