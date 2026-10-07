import express from 'express';
import mongoose from 'mongoose';
import District from '../models/District.js';
import GridSubstation from '../models/GridSubstation.js';
import GenerationReading from '../models/GenerationReading.js';
import SolarInstallation from '../models/SolarInstallation.js';
import { authenticate, authorizeJurisdiction } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Districts
 *   description: District & Grid Substation Management API
 */

/**
 * @swagger
 * /api/districts:
 *   get:
 *     summary: Get all districts
 *     tags: [Districts]
 *     responses:
 *       200:
 *         description: List of all districts retrieved successfully
 *       500:
 *         description: Internal server error
 */

// GET /districts
router.get('/', async (req, res) => {
  try {
    const districts = await District.find();
    res.json(districts);
  } catch (error) {
    res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
  }
});


/**
 * @swagger
 * /api/districts/{districtId}/substations:
 *   get:
 *     summary: Get grid substations for a specific district
 *     tags: [Districts]
 *     parameters:
 *       - in: path
 *         name: districtId
 *         required: true
 *         schema:
 *           type: string
 *         description: District ID or code
 *     responses:
 *       200:
 *         description: List of grid substations for the district retrieved successfully
 *       404:
 *         description: District not found
 *       500:
 *         description: Internal server error
 */

// GET /districts/:districtId/substations
router.get("/:districtId/substations", async (req, res) => {
    try{
      const { districtId } = req.params;
      let targetCode = districtId.toUpperCase();

      if(mongoose.Types.ObjectId.isValid(districtId)) {
          const districtDoc = await District.findById(districtId);
          if(districtDoc) {
              targetCode = districtDoc.code;
          }
      }

      const substations = await GridSubstation.find({
         district_code: { $regex: new RegExp(`^${targetCode}$`, 'i') }
      });

      if(!substations || substations.length === 0) {
          return res.status(404).json({
              code: 'NOT_FOUND',
              message: `No grid substations found for district: ${districtId}`
          });
      }
      res.status(200).json(substations);

    }catch(error) {
      res.status(500).json({ 
        code: 'SERVER_ERROR', 
        message: error.message });
    }
}



)

router.get(
  '/:id/generation-summary',
  authenticate,
  authorizeJurisdiction((req) => req.params.id), 
  async (req, res) => {
    try {
      const { id } = req.params; 
      const { from, to } = req.query;

     
      const installations = await SolarInstallation.find({ district_code: id }, '_id');
      const installationIds = installations.map((inst) => inst._id);

      if (installationIds.length === 0) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: `No installations found for district code: ${id}`
        });
      }

      
      const filter = { installation_id: { $in: installationIds } };
      if (from || to) {
        filter.timestamp = {};
        if (from) filter.timestamp.$gte = new Date(from);
        if (to) filter.timestamp.$lte = new Date(to);
      }

     
      const summary = await GenerationReading.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total_readings: { $sum: 1 },
            total_instantaneous_kw: { $sum: '$instantaneous_kw' },
            total_cumulative_kwh: { $sum: '$cumulative_kwh' },
            avg_instantaneous_kw: { $avg: '$instantaneous_kw' },
            max_instantaneous_kw: { $max: '$instantaneous_kw' },
            min_instantaneous_kw: { $min: '$instantaneous_kw' }
          }
        }
      ]);

      const resultData = summary.length > 0 ? summary[0] : {
        total_readings: 0,
        total_instantaneous_kw: 0,
        total_cumulative_kwh: 0,
        avg_instantaneous_kw: 0,
        max_instantaneous_kw: 0,
        min_instantaneous_kw: 0
      };

      res.status(200).json({
        district_code: id,
        total_installations: installationIds.length,
        time_frame: {
          from: from || 'all-time',
          to: to || 'all-time'
        },
        summary: {
          total_readings_count: resultData.total_readings,
          total_instantaneous_kw: Number(resultData.total_instantaneous_kw.toFixed(2)),
          total_cumulative_kwh: Number(resultData.total_cumulative_kwh.toFixed(2)),
          avg_instantaneous_kw: Number(resultData.avg_instantaneous_kw.toFixed(2)),
          max_instantaneous_kw: resultData.max_instantaneous_kw,
          min_instantaneous_kw: resultData.min_instantaneous_kw
        }
      });
    } catch (error) {
      res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Failed to generate district summary',
        details: error.message
      });
    }
  }
);

export default router;