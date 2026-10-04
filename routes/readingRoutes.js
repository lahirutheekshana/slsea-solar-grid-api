import express from 'express';
import GenerationReading from '../models/GenerationReading.js';
import SolarInstallation from '../models/SolarInstallation.js';
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get(
  '/installations/:id/readings',
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split('_')[1]), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, sort = '-timestamp', from, to } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const filter = { installation_id: id };
      if (from || to) {
        filter.timestamp = {};
        if (from) filter.timestamp.$gte = new Date(from);
        if (to) filter.timestamp.$lte = new Date(to);
      }

      const totalCount = await GenerationReading.countDocuments(filter);
      const readings = await GenerationReading.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        pagination: {
          totalRecords: totalCount,
          currentPage: pageNum,
          totalPages: totalPages,
          pageSize: limitNum,
          nextPage: pageNum < totalPages ? `/api/installations/${id}/readings?page=${pageNum + 1}&limit=${limitNum}` : null,
          prevPage: pageNum > 1 ? `/api/installations/${id}/readings?page=${pageNum - 1}&limit=${limitNum}` : null
        },
        data: readings
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve generation readings',
        details: error.message
      });
    }
  }
);


router.get(
  '/installations/:id/readings/latest',
  authenticate,
  authorizeJurisdiction((req) => req.params.id.split('_')[1]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const latestReading = await GenerationReading.findOne({ installation_id: id })
        .sort({ timestamp: -1 });

      if (!latestReading) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `No generation readings found for installation ID: ${id}`
        });
      }

      res.status(200).json({
        installation_id: id,
        last_known_reading: latestReading
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Error fetching latest reading',
        details: error.message
      });
    }
  }
);


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

export default router;