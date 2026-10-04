import mongoose from 'mongoose';

const gridSubstationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // GSS_COL_01...
  name: { type: String, required: true },
  district_code: { type: String, required: true, ref: 'District' }
});



export default mongoose.models.GridSubstation || mongoose.model('GridSubstation', gridSubstationSchema, 'gridsubstations');