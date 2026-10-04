import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';


const router = express.Router();


router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || user.password !== password) { 
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password'
      });
    }

    const secretKey = process.env.JWT_SECRET || 'slsea_super_secret_key_2026'
    
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        jurisdiction_scope: user.jurisdiction_scope
      },
      secretKey,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Authentication successful',
      token: token,
      user: {
        username: user.username,
        role: user.role,
        jurisdiction_scope: user.jurisdiction_scope
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: error.message
    });
  }
});

export default router;