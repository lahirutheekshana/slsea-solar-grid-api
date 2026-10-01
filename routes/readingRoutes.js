import express from 'express';
import GenerationReading from '../models/GenerationReading.js';

const router = express.Router();

// Write Path: POST Ingestion for a new generation reading
router.post('/installations/:id/readings', async (req, res) => {
  try {
    const { id } = req.params;
    const { instantaneous_kw, cumulative_kwh, voltage, timestamp } = req.body;

    // 1. Validation Check
    if (instantaneous_kw === undefined || cumulative_kwh === undefined) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'instantaneous_kw and cumulative_kwh are required fields'
      });
    }

    // 2. Create new record
    const newReading = new GenerationReading({
      installation_id: id,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      instantaneous_kw,
      cumulative_kwh,
      voltage: voltage || 230
    });

    // 3. Save to Database
    const savedReading = await newReading.save();

    // 4. Set Location Header and return 201 Created
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
});

export default router;