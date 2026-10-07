import express from "express";
import mongoose from "mongoose";
import Province from "../models/Province.js";
import District from "../models/District.js"


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Provinces
 *   description: Province Management API
 */

/**
 * @swagger
 * /api/provinces:
 *   get:
 *     summary: Get all provinces
 *     tags: [Provinces]
 *     responses:
 *       200:
 *         description: List of all provinces retrieved successfully
 *       500:
 *         description: Server error
 */

// GET /provinces
router.get("/", async (req, res) => {
    try{
        const provinces = await Province.find(); 
        res.json(provinces);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }
});

/**
 * @swagger
 * /api/provinces/{id}:
 *   get:
 *     summary: Get province details by MongoDB ObjectId or Province Code
 *     tags: [Provinces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Province MongoDB ObjectId or Province Code (e.g., WP, CP)
 *     responses:
 *       200:
 *         description: Province details retrieved successfully
 *       404:
 *         description: Province not found
 *       500:
 *         description: Server error
 */

// GET /provinces/:id
router.get("/:id", async (req, res) => {
    try{
        const { id } = req.params;
        let province = null;

        if (mongoose.Types.ObjectId.isValid(id)) {
            province = await Province.findById(id);
        }

        if (!province) {
            province = await Province.findOne({code: id.toUpperCase() });
        }

        if (!province) {
            return res.status(404).json({ 
                code: 'NOT_FOUND', 
                message: 'Province not found' 
            });
        }
        res.json(province);
    } catch (error) {
        res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
    }
});

/**
 * @swagger
 * /api/provinces/{provinceId}/districts:
 *   get:
 *     summary: Get all districts within a specific province
 *     tags: [Provinces]
 *     parameters:
 *       - in: path
 *         name: provinceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Province Code (e.g., WP) or MongoDB ObjectId
 *     responses:
 *       200:
 *         description: List of districts in the specified province
 *       500:
 *         description: Server error
 */

// GET /provinces/:provinceId/districts
router.get("/:provinceId/districts", async (req, res) => {
    try{
        const { provinceId } = req.params;
        let targetCode = provinceId.toUpperCase();

        if(mongoose.Types.ObjectId.isValid(provinceId)) {
            const provinceDoc = await Province.findById(provinceId);
            if(provinceDoc) {
                targetCode = provinceDoc.code;
            }
        }

        const districts = await District.find({ province_code: targetCode });
        res.json(districts);
    } catch (error) {
        res.status(500).json({ code: 'SERVER_ERROR', message: error.message });
    }
});

export default router;