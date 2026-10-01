import mongoose from 'mongoose';

const solarInstallationSchema = new mongoose.Schema({
  installation_id: { type: String, required: true, unique: true }, // SOL_COL_001...
  owner_name: { type: String, required: true },
  capacity_kw: { type: Number, required: true },
  meter_id: { type: String, required: true }, // Attribute as required
  substation_code: { type: String, required: true, ref: 'GridSubstation' }
});

export default mongoose.model('SolarInstallation', solarInstallationSchema);