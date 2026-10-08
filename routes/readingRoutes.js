import express from 'express';
import GenerationReading from '../models/GenerationReading.js';
import SolarInstallation from '../models/SolarInstallation.js';
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Readings
 *   description: Solar Generation Readings Management
 */

/**
 * @swagger
 * /api/installations/{id}/readings:
 *   post:
 *     summary: Ingest a new generation reading for an installation
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Installation ID or unique code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instantaneous_kw
 *               - cumulative_kwh
 *             properties:
 *               instantaneous_kw:
 *                 type: number
 *                 example: 4.5
 *               cumulative_kwh:
 *                 type: number
 *                 example: 1250.85
 *               voltage:
 *                 type: number
 *                 example: 230
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-10-07T10:00:00Z"
 *     responses:
 *       201:
 *         description: Generation reading ingested successfully
 *       400:
 *         description: Validation error (missing required fields)
 *       404:
 *         description: Installation not found
 *       500:
 *         description: Server error
 */

//POST ingest generation reading
router.post(
  '/installations/:id/readings',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { instantaneous_kw, cumulative_kwh, voltage, timestamp } = req.body;

      if (instantaneous_kw === undefined || cumulative_kwh === undefined) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'instantaneous_kw and cumulative_kwh are required fields'
        });
      }

      const installationExists = await SolarInstallation.findOne({
        $or: [{ installation_id: id }, { code: id }]
      });

      if (!installationExists) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `Installation not found with id: ${id}`
        });
      }

      const newReading = new GenerationReading({
        installation_id: id,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        instantaneous_kw,
        cumulative_kwh,
        voltage: voltage || 230
      });

      const savedReading = await newReading.save();

      const resourceLocation = `/api/installations/${id}/readings/${savedReading._id}`;
      res.setHeader('Location', resourceLocation);

      res.status(201).json({
        message: 'Generation reading ingested successfully',
        location: resourceLocation,
        data: savedReading
      });
    } catch (error) {
      res.status(500).json({
        code: 'INGESTION_ERROR',
        message: 'Failed to ingest generation reading',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/installations/{id}/readings:
 *   get:
 *     summary: Retrieve paginated generation readings for an installation
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "SOL_GAM_007"
 *         description: Installation ID, Code, or MongoDB ObjectId
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-10-01"
 *         description: Filter readings starting from date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-10-08"
 *         description: Filter readings up to date (YYYY-MM-DD)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: timestamp
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of generation readings with pagination metadata
 *       404:
 *         description: Installation not found
 *       500:
 *         description: Server error
 */

// GET /installations/:id/readings (With Pagination, Time Window & Sorting)
router.get("/:id/readings", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 10, sort = 'timestamp', order = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    
    const queryFilter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { installation_id: {$regex: new RegExp(`^${id}$`, "i") } }, { code: { $regex: new RegExp(`^${id}$`, "i") } }] }
      : { $or: [{ installation_id: {$regex: new RegExp(`^${id}$`, "i") } }, { code: { $regex: new RegExp(`^${id}$`, "i") } }] };

    const installation = await SolarInstallation.findOne(queryFilter);

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
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
        filter.timestamp.$lte = end;
      }
    }

    
    const sortOrder = String(order).toLowerCase() === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sort] = sortOrder;

    
    const totalReadings = await GenerationReading.countDocuments(filter);
    const readings = await GenerationReading.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalReadings / limitNum) || 1;

    res.status(200).json({
      pagination: {
        total_items: totalReadings,
        current_page: pageNum,
        limit: limitNum,
        total_pages: totalPages
      },
      sorting: {
        sort_by: sort,
        order: String(order).toLowerCase()
      },
      data: readings
    });
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});

export default router;