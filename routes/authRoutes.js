import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';


const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User Authentication & JWT Token Management API
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and issue a JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Authentication successful, returns JWT bearer token and user profile
 *       401:
 *         description: Invalid username or password
 *       500:
 *         description: Internal server error
 */

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