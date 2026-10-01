import express from "express";
import Province from "../models/Province.js";

const router = express.Router();

// GET ALL PROVINCES
router.get("/", async (req, res) => {
    try{
        const provinces = await Province.find(); 
        res.json(provinces);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }
});

export default router;