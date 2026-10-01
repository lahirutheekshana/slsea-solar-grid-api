import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // COL, KAN, GAL...
  name: { type: String, required: true },
  province_code: { type: String, required: true, ref: 'Province' }
});

export default mongoose.model('District', districtSchema);