import mongoose from 'mongoose';

const generationReadingSchema = new mongoose.Schema({
  installation_id: { type: String, required: true, ref: 'SolarInstallation' },
  timestamp: { type: Date, required: true },
  instantaneous_kw: { type: Number, required: true },
  cumulative_kwh: { type: Number, required: true },
  voltage: { type: Number, required: true }
});

export default mongoose.model('GenerationReading', generationReadingSchema);