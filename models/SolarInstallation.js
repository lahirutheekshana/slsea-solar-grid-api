import mongoose from 'mongoose';

const solarInstallationSchema = new mongoose.Schema({
  installation_id: { type: String, required: true, unique: true }, 
  owner_name: { type: String, required: true },
  capacity_kw: { type: Number, required: true },
  meter_id: { type: String, required: true }, 
  substation_code: { 
    type: String, 
    required: true,
     ref: 'GridSubstation' }
});


export default mongoose.models.SolarInstallation || mongoose.model('SolarInstallation', solarInstallationSchema);