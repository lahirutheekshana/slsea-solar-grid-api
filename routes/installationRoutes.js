import express from "express";
import SoloInstallation from "../models/SolarInstallation.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try{
        const installations = await SoloInstallation.find();
        res.json(installations);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }       
});

export default router;