import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/db.js';
import { CONFIG } from '../../config.js';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// Register Route
router.post('/signup', async (req: Request, res: Response) => {
  const { phone, password, name, role } = req.body;

  if (!phone || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing required signup fields' });
  }

  if (role !== 'VENDOR' && role !== 'CUSTOMER') {
    return res.status(400).json({ error: 'Role must be VENDOR or CUSTOMER' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        phone,
        name,
        role,
        password: hashedPassword,
      },
    });

    // Create an empty shop profile automatically if the user is a vendor
    if (role === 'VENDOR') {
      await prisma.shop.create({
        data: {
          name: `${name}'s Shop`,
          category: 'General',
          vendorId: user.id,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      CONFIG.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error('❌ [Signup Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login Route
router.post('/login', async (req: Request, res: Response) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Missing phone or password' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { shop: true },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid phone or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid phone or password' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      CONFIG.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
      shop: user.shop,
    });
  } catch (err) {
    console.error('❌ [Login Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Profile Info
router.get('/profile', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { shop: { include: { operatingHours: true } } },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      shop: user.shop,
    });
  } catch (err) {
    console.error('❌ [Profile Fetch Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
