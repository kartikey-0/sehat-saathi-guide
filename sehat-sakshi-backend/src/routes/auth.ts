import { Router, Response } from 'express';
import { User } from '../models/User';
import { generateToken, protect, AuthRequest } from '../middleware/auth';
import { logAuthEvent, logProfileUpdate, logFailedAuth } from '../utils/auditLogger';
import logger from '../config/logger';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logFailedAuth(email, 'User already exists', req);
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const user = await User.create({ name, email, phone, password });
    const token = generateToken(user._id as string);

    // Log successful registration
    logAuthEvent('REGISTER', user._id.toString(), true, req, { email, name });
    logger.info(`New user registered: ${email}`, {
      requestId: req.id,
      userId: user._id,
      email,
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
      token,
    });
  } catch (error: any) {
    logger.error('Registration error:', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      logFailedAuth(email, 'Invalid credentials', req);
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user._id as string);

    // Log successful login
    logAuthEvent('LOGIN', user._id.toString(), true, req, { email });
    logger.info(`User logged in: ${email}`, {
      requestId: req.id,
      userId: user._id,
      email,
    });

    res.json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, profilePic: user.profilePic },
      token,
    });
  } catch (error: any) {
    logger.error('Login error:', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  logger.debug('Fetching current user', {
    requestId: req.id,
    userId: (req.user! as any)._id,
  });

  res.json({
    user: {
      id: (req.user! as any)._id,
      name: req.user!.name,
      email: req.user!.email,
      phone: req.user!.phone,
      profilePic: req.user!.profilePic,
    },
  });
});

// Update profile
router.put('/profile', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, profilePic } = req.body;
    const userId = (req.user! as any)._id.toString();

    const updatedFields = [];
    if (name) updatedFields.push('name');
    if (phone) updatedFields.push('phone');
    if (profilePic) updatedFields.push('profilePic');

    const user = await User.findByIdAndUpdate(
      userId,
      { name, phone, profilePic },
      { new: true }
    );

    // Log profile update
    logProfileUpdate(userId, req, updatedFields);
    logger.info(`Profile updated for user: ${userId}`, {
      requestId: req.id,
      userId,
      updatedFields,
    });

    res.json({
      user: { id: user!._id, name: user!.name, email: user!.email, phone: user!.phone, profilePic: user!.profilePic },
    });
  } catch (error: any) {
    logger.error('Profile update error:', {
      requestId: req.id,
      userId: (req.user! as any)._id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
