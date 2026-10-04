import express from "express";
import Province from "../models/Province.js";

const router = express.Router();


router.get("/", async (req, res) => {
    try{
        const provinces = await Province.find(); 
        res.json(provinces);
    } catch (error) {
        res.status(500).json({  code: 'SERVER_ERROR', message: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try{
        const { id } = req.params;

        const province = await Province.findOne({
            $or: [{ province_code: id.toUpperCase() }, { _id: id}]
        });

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