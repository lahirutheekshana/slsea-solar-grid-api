import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import SolarInstallation from "../models/SolarInstallation.js";
import GenerationReading from "../models/GenerationReading.js";
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/installations:
 *   get:
 *     summary: Retrieve all solar installations (With optional Jurisdiction filtering)
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: query
 *         name: province_id
 *         schema:
 *           type: string
 *         description: Filter installations by Province ID
 *       - in: query
 *         name: district_id
 *         schema:
 *           type: string
 *         description: Filter installations by District ID
 *     responses:
 *       200:
 *         description: Successfully retrieved solar installations list
 *       500:
 *         description: Internal Server Error
 */

// GET /installations
router.get("/", async (req, res) => {
  try {
    const installations = await SolarInstallation.find();
    res.json(installations);
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});

/**
 * @openapi
 * /api/installations/{id}:
 *   get:
 *     summary: Get installation details by ID (Supports Conditional GET / ETag)
 *     tags:
 *       - Installations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Solar Installation ID or Code
 *     responses:
 *       200:
 *         description: Installation details retrieved successfully
 *       304:
 *         description: Not Modified (Conditional GET matching ETag)
 *       404:
 *         description: Installation not found
 */

// GET /installations with optional query parameters for filtering
router.get("/", async (req, res) => {
  try {
    const { province_id, district_id } = req.query;
    const filter = {};

    
    if (province_id) filter.province_id = province_id;
    if (district_id) filter.district_id = district_id;

    const installations = await SolarInstallation.find(filter);
    res.status(200).json(installations);
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});



// GET /installations/:id/readings with optional query parameters for filtering and pagination
router.get("/:id/readings", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let installation = await SolarInstallation.findOne({
      $or: [
        { installation_id: { $regex: new RegExp(`^${id}$`, "i") } },
        { code: { $regex: new RegExp(`^${id}$`, "i") } },
      ],
    });

    if (!installation) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Installation not found" });
    }

    const instId = installation.installation_id || installation._id;
    const filter = {
      $or: [
        { installation_id: String(instId) },
        { installation_id: String(installation._id) }
      ]
    };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const totalReadings = await GenerationReading.countDocuments(filter);
    const readings = await GenerationReading.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalReadings / limitNum);

    res.status(200).json({
      pagination: {
        total_items: totalReadings,
        current_page: pageNum,
        limit: limitNum,
        total_pages: totalPages
      },
      data: readings
    });
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

    if (req.user.role !== 'ADMIN' && req.user.district_id && req.user.district_id !== installation.district_id) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: `Access denied. Your scope (${req.user.district_id}) cannot access records in ${installation.district_id}.`
      });
    }

    const dataString = JSON.stringify(installation);
    const etag = crypto.createHash('md5').update(dataString).digest('hex');

    const clientEtag = req.headers['if-none-match'];

    if (clientEtag === `"${etag}"` || clientEtag === etag) {
      return res.status(304).send();
    }

    res.setHeader('Etag', `"${etag}"` );
    res.status(200).json(installation);
  } catch (error) {
    res.status(500).json({ 
      code: "SERVER_ERROR", 
      message: error.message,
      details: error.message
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
        { installation_id: String(installation._id) }
      ]
    };

    const totalReadings = await GenerationReading.countDocuments(filter);

    const readings = await GenerationReading.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalReadings / limit);

   const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}/${id}/readings`;
    const nextLink = page < totalPages ? `${baseUrl}?page=${page + 1}&limit=${limit}` : null;
    const prevLink = page > 1 ? `${baseUrl}?page=${page - 1}&limit=${limit}` : null;

    res.status(200).json({
      pagination: {
        total_items: totalReadings,
        current_page: page,
        limit: limit,
        total_pages: totalPages,
        next: nextLink,
        previous: prevLink
      },
      data: readings
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
 * /api/installations/{id}:
 *   put:
 *     summary: Fully update a solar installation (Requires JWT)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - owner_name
 *               - capacity_kw
 *               - grid_substation_code
 *             properties:
 *               name:
 *                 type: string
 *               owner_name:
 *                 type: string
 *               capacity_kw:
 *                 type: number
 *               grid_substation_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Installation fully updated
 *       400:
 *         description: Validation Error
 *       401:
 *         description: Unauthorized
 */

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

/**
 * @openapi
 * /api/installations/{id}:
 *   patch:
 *     summary: Partially update a solar installation (Requires JWT)
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
 *         description: Installation partially updated
 */

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