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

export default router;