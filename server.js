import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import provinceRoutes from "./routes/provinceRoutes.js";
import districtRoutes from "./routes/districtRoutes.js";
import installationRoutes from "./routes/installationRoutes.js";
import readingRoutes from "./routes/readingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSwagger } from "./swagger/swagger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

setupSwagger(app);


app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(" MongoDB Database Connected Successfully!");
  })
  .catch((err) => {
    console.error(" MongoDB Connection Error:", err.message);
  });

app.use("/api/provinces", provinceRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/installations", installationRoutes);
app.use("/api", readingRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` API Documentation available at http://localhost:${PORT}/api-docs`);
});
