import express from 'express';
import GenerationReading from '../models/GenerationReading.js';
import SolarInstallation from '../models/SolarInstallation.js';
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();


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

// GET /installations/:id/readings (With Pagination, Time Window & Sorting)
router.get("/:id/readings", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 10, sort = 'timestamp', order = 'desc' } = req.query;

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

    const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sort] = sortOrder;

    const totalReadings = await GenerationReading.countDocuments(filter);
    

    const readings = await GenerationReading.find(filter)
      .sort(sortOptions)
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
      sorting: {
        sort_by: sort,
        order: order
      },
      data: readings
    });
  } catch (error) {
    res.status(500).json({ code: "SERVER_ERROR", message: error.message });
  }
});

export default router;