import express from "express";
import mongoose from "mongoose";
import Province from "../models/Province.js";

const router = express.Router();

// GET /provinces
router.get("/", async (req, res) => {
    try{
        const provinces = await Province.find(); 
        res.json(provinces);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }
});

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

export default router;