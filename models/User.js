import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['READ_CLIENT', 'WRITE_CLIENT'], required: true },
  jurisdiction_scope: { type: String, default: 'ALL' } // e.g., 'COL', 'WP', 'ALL'
});

export default mongoose.model('User', userSchema);
