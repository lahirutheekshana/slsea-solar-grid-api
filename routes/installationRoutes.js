import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import SolarInstallation from "../models/SolarInstallation.js";
import GenerationReading from "../models/GenerationReading.js";
import {
  authenticate,
  authorizeJurisdiction,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/installations:
 *   get:
 *     summary: Retrieve all solar installations (With optional Jurisdiction filtering)
 *     description: Gets a list of solar installations with optional filtering by district or province.
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: query
 *         name: district_code
 *         schema:
 *           type: string
 *         example: "COL"
 *         description: Filter installations by District Code (e.g., COL, KAL, KAN)
 *       - in: query
 *         name: province_code
 *         schema:
 *           type: string
 *         example: "WP"
 *         description: Filter installations by Province Code (e.g., WP, CP)
 *     responses:
 *       200:
 *         description: Successfully retrieved solar installations list
 *       500:
 *         description: Internal Server Error
 */

// GET /installations
router.get("/", async (req, res) => {
  try {
    
    const district = req.query.district_code || req.query.district_id;
    const province = req.query.province_code || req.query.province_id;

    const filter = {};

    if (district) {
      const code = district.trim().toUpperCase();
      
      filter.$or = [
        { installation_id: { $regex: new RegExp(`_${code}_`, "i") } },
        { substation_code: { $regex: new RegExp(`_${code}_`, "i") } },
        { district_id: { $regex: new RegExp(`^${code}$`, "i") } }
      ];
    }

    if (province) {
      const pCode = province.trim().toUpperCase();
      filter.$or = [
        ...(filter.$or || []),
        { province_code: { $regex: new RegExp(`^${pCode}$`, "i") } },
        { province_id: { $regex: new RegExp(`^${pCode}$`, "i") } }
      ];
    }

    const installations = await SolarInstallation.find(filter);
    res.status(200).json(installations);

  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Failed to retrieve solar installations",
      details: error.message,
    });
  }
});


/**
 * @swagger
 * /api/installations/{id}:
 *   get:
 *     summary: Get installation details by ID (Supports Conditional GET / ETag & Auth)
 *     tags:
 *       - Installations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Solar Installation ID or MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Installation details retrieved successfully
 *       304:
 *         description: Not Modified (Conditional GET matching ETag)
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *       403:
 *         description: Forbidden - Access denied for user district jurisdiction scope
 *       404:
 *         description: Installation not found
 *       500:
 *         description: Internal Server Error
 */

// GET /installations/:id
router.get("/:id", authenticate, async (req, res) => {
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

    
    const userRole = req.user?.role;
    const userDistrict = req.user?.district_id || req.user?.district_code;
    const instDistrict = installation.district_id || installation.district_code;

    if (userRole && userRole !== "ADMIN" && userDistrict && instDistrict) {
      if (userDistrict !== instDistrict) {
        return res.status(403).json({
          code: "FORBIDDEN",
          message: `Access denied. Your scope (${userDistrict}) cannot access records in ${instDistrict}.`,
        });
      }
    }

    
    const dataString = JSON.stringify(installation);
    const etag = crypto.createHash("md5").update(dataString).digest("hex");
    const clientEtag = req.headers["if-none-match"];

    if (clientEtag === `"${etag}"` || clientEtag === etag) {
      return res.status(304).send(); // Not Modified
    }

    res.setHeader("Etag", `"${etag}"`);
    res.status(200).json(installation);

  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: error.message,
      details: error.message,
    });
  }
});

/**
 * @openapi
 * /api/installations/{id}/composite:
 *   get:
 *     summary: Retrieve composite metrics and latest reading for an installation
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Composite analytics retrieved successfully
 *       404:
 *         description: Installation not found
 */

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
        $match: {
          $or: [
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

/**
 * @openapi
 * /api/installations/{id}/last-reading:
 *   get:
 *     summary: Retrieve the latest generation reading for an installation
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Latest reading retrieved successfully
 *       404:
 *         description: Installation not found
 */

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
        { installation_id: String(installation._id) },
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

/**
 * @openapi
 * /api/installations/{id}/readings:
 *   get:
 *     summary: Retrieve historical generation readings (Pagination & Time Window Filter)
 *     tags:
 *       - Readings
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Filter readings starting from ISO Date string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Filter readings up to ISO Date string
 *     responses:
 *       200:
 *         description: Readings history retrieved successfully
 */

// GET /installations/:id/readings
router.get("/:id/readings", async (req, res) => {
  try {
    const { id } = req.params;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

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
    const filter = {
      $or: [
        { installation_id: String(instId) },
        { installation_id: String(installation._id) },
      ],
    };

    const totalReadings = await GenerationReading.countDocuments(filter);

    const readings = await GenerationReading.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReadings / limit);

    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}/${id}/readings`;
    const nextLink =
      page < totalPages ? `${baseUrl}?page=${page + 1}&limit=${limit}` : null;
    const prevLink =
      page > 1 ? `${baseUrl}?page=${page - 1}&limit=${limit}` : null;

    res.status(200).json({
      pagination: {
        total_items: totalReadings,
        current_page: page,
        limit: limit,
        total_pages: totalPages,
        next: nextLink,
        previous: prevLink,
      },
      data: readings,
    });
  } catch (error) {
    res.status(500).json({
      code: "SERVER_ERROR",
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/installations/{id}:
 *   put:
 *     summary: Fully update a solar installation (Requires JWT)
 *     description: Updates an existing solar installation by ID using full resource payload matching the database schema.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "SOL_GAM_007"
 *         description: Solar Installation ID, Code, or MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - owner_name
 *               - capacity_kw
 *               - substation_code
 *             properties:
 *               owner_name:
 *                 type: string
 *                 example: "Solar Producer Gampaha #7"
 *                 description: Owner or producer name of the installation
 *               capacity_kw:
 *                 type: number
 *                 example: 35
 *                 description: System capacity in Kilowatts (kW)
 *               substation_code:
 *                 type: string
 *                 example: "GSS_GAM_01"
 *                 description: Grid substation code associated with the installation
 *               meter_id:
 *                 type: string
 *                 example: "MTR-SOL_GAM_007"
 *                 description: Unique identification string for the connected meter
 *               province_id:
 *                 type: string
 *                 example: "WP"
 *                 description: Province code or ID
 *               district_id:
 *                 type: string
 *                 example: "GAM"
 *                 description: District code or ID
 *     responses:
 *       200:
 *         description: Installation fully updated successfully
 *       400:
 *         description: Validation Error - Missing required fields (owner_name, capacity_kw, substation_code)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT Bearer token
 *       403:
 *         description: Forbidden - Access denied due to jurisdiction scope restriction
 *       404:
 *         description: Installation not found with the given ID
 *       500:
 *         description: Internal Server Error
 */

// PUT /installations/:id (Full Update)
router.put(
  "/:id",
  authenticate,
  authorizeJurisdiction((req) => {
    
    const parts = req.params.id.split("_");
    return parts.length > 1 ? parts[1] : req.params.id;
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        owner_name,
        capacity_kw,
        substation_code,
        grid_substation_code, // DB Field name Compatibility
        meter_id,
        province_id,
        district_id,
      } = req.body;

      
      const finalSubstationCode = substation_code || grid_substation_code;

      
      if (!owner_name || capacity_kw === undefined || !finalSubstationCode) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message:
            "PUT requires all required resource fields (owner_name, capacity_kw, substation_code) for a full update.",
        });
      }

      
      const queryFilter = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { installation_id: id }, { code: id }] }
        : { $or: [{ installation_id: id }, { code: id }] };

      
      const updateData = {
        owner_name,
        capacity_kw: Number(capacity_kw),
        substation_code: finalSubstationCode,
      };

      if (meter_id) updateData.meter_id = meter_id;
      if (province_id) updateData.province_id = province_id;
      if (district_id) updateData.district_id = district_id;

      const updatedInstallation = await SolarInstallation.findOneAndUpdate(
        queryFilter,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedInstallation) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: `Installation not found with id: ${id}`,
        });
      }

      res.status(200).json({
        message: "Installation fully updated successfully",
        data: updatedInstallation,
      });
    } catch (error) {
      res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to update installation",
        details: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/installations/{id}:
 *   patch:
 *     summary: Partially update a solar installation (Requires JWT)
 *     description: Updates specific fields of an existing solar installation without replacing the entire object.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "SOL_GAM_007"
 *         description: Solar Installation ID, Code, or MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               owner_name:
 *                 type: string
 *                 example: "Solar Producer Gampaha #7 Updated"
 *               capacity_kw:
 *                 type: number
 *                 example: 45
 *               substation_code:
 *                 type: string
 *                 example: "GSS_GAM_01"
 *               meter_id:
 *                 type: string
 *                 example: "MTR-SOL_GAM_007"
 *               province_id:
 *                 type: string
 *                 example: "WP"
 *               district_id:
 *                 type: string
 *                 example: "GAM"
 *     responses:
 *       200:
 *         description: Installation partially updated successfully
 *       400:
 *         description: Validation Error - Request body is empty or invalid
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - Access denied due to jurisdiction scope restriction
 *       404:
 *         description: Installation not found
 *       500:
 *         description: Internal Server Error
 */

// PATCH /installations/:id (Partially Update Solar Installation)
router.patch(
  "/:id",
  authenticate,
  authorizeJurisdiction((req) => {
    
    const parts = req.params.id.split("_");
    return parts.length > 1 ? parts[1] : req.params.id;
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "No update fields provided in request body.",
        });
      }

      if (updates.grid_substation_code && !updates.substation_code) {
        updates.substation_code = updates.grid_substation_code;
        delete updates.grid_substation_code;
      }

      const queryFilter = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { installation_id: id }, { code: id }] }
        : { $or: [{ installation_id: id }, { code: id }] };

       const updatedInstallation = await SolarInstallation.findOneAndUpdate(
        queryFilter,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!updatedInstallation) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: `Installation not found with id: ${id}`,
        });
      }

      res.status(200).json({
        message: "Installation partially updated successfully",
        data: updatedInstallation,
      });
    } catch (error) {
      res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to partially update installation",
        details: error.message,
      });
    }
  }
);

/**
 * @openapi
 * /api/installations/{id}:
 *   delete:
 *     summary: Delete a solar installation (Requires JWT)
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Installation deleted successfully
 */

// DELETE /installations/:id (Delete Resource)
router.delete(
  "/:id",
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split("_")[1]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const deletedInstallation = await SolarInstallation.findOneAndDelete({
        $or: [{ installation_id: id }, { code: id }],
      });

      if (!deletedInstallation) {
        return res.status(404).json({
          code: "NOT_FOUND",
          message: `Installation not found with id: ${id}`,
        });
      }

      res.status(200).json({
        message: `Installation ${id} deleted successfully`,
        deleted_id: id,
      });
    } catch (error) {
      res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to delete installation",
        details: error.message,
      });
    }
  },
);

export default router;
