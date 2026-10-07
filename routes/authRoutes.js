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
 *                 example: "officer_colombo"
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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register or create a new user profile
 *     description: Creates a new user with specific role and jurisdiction scope (e.g., COL, KAN, KAL, ALL).
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *               - jurisdiction_scope
 *             properties:
 *               username:
 *                 type: string
 *                 example: "officer_kalutara"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [officer, admin, viewer]
 *                 example: "officer"
 *               jurisdiction_scope:
 *                 type: string
 *                 example: "KAL"
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Username already exists or invalid data
 *       500:
 *         description: Server error
 */

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, jurisdiction_scope } = req.body;

    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        code: 'USER_EXISTS',
        message: 'Username is already taken'
      });
    }


    const newUser = new User({
      username,
      password, 
      role,
      jurisdiction_scope: jurisdiction_scope.toUpperCase()
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        jurisdiction_scope: newUser.jurisdiction_scope
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Failed to create user',
      details: error.message
    });
  }
});

export default router;