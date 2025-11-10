import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { generateToken } from '../config/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, avatarUrl } = req.body;

    if (!phone || !phone.trim()) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const normalizedPhone = phone.trim();

    const phoneExists = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (phoneExists) {
      res.status(400).json({ error: 'Phone number already registered' });
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase() ?? null;

    if (normalizedEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingEmail) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        phone: normalizedPhone,
        avatarUrl: avatarUrl ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
      },
    });
    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !phone.trim()) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        phone: req.user.phone,
        avatarUrl: req.user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { email, firstName, lastName, phone, avatarUrl } = req.body as {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string | null;
    };

    if (phone !== undefined && !phone.trim()) {
      res.status(400).json({ error: 'Phone number cannot be empty' });
      return;
    }

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
      },
    });

    if (!current) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let normalizedEmail: string | null | undefined = undefined;
    if (email !== undefined) {
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        normalizedEmail = trimmedEmail.toLowerCase();
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            NOT: { id: userId },
          },
          select: { id: true },
        });
        if (existingEmail) {
          res.status(400).json({ error: 'Email already in use' });
          return;
        }
      } else {
        normalizedEmail = null;
      }
    }

    let normalizedPhone: string | undefined = undefined;
    if (phone !== undefined) {
      normalizedPhone = phone.trim();
      if (normalizedPhone !== current.phone) {
        const existingPhone = await prisma.user.findFirst({
          where: {
            phone: normalizedPhone,
            NOT: { id: userId },
          },
          select: { id: true },
        });
        if (existingPhone) {
          res.status(400).json({ error: 'Phone number already in use' });
          return;
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail !== undefined ? normalizedEmail : current.email,
        firstName: firstName ?? current.firstName,
        lastName: lastName ?? current.lastName,
        phone: normalizedPhone ?? current.phone,
        avatarUrl: avatarUrl ?? current.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    req.user = updated;

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};