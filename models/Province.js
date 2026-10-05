import mongoose from 'mongoose';

const provinceSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // WP, CP, SP...
  name: { type: String, required: true }
});

export default mongoose.model('Province', provinceSchema);
