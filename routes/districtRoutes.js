import express from "express";
import District from "../models/district.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try{
        const districts = await District.find();
        res.json(districts);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }
});

export default router;