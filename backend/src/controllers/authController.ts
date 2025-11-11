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

    const {
      email,
      firstName,
      lastName,
      phone,
      avatarUrl,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body as {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string | null;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (phone !== undefined && !phone.trim()) {
      console.warn(`[auth] updateProfile rejected: empty phone`, { userId });
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
        password: true,
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
          console.warn(`[auth] updateProfile rejected: email already used`, {
            userId,
            normalizedEmail,
          });
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
          console.warn(`[auth] updateProfile rejected: phone already used`, {
            userId,
            normalizedPhone,
          });
          res.status(400).json({ error: 'Phone number already in use' });
          return;
        }
      }
    }

    const wantsPasswordChange =
      Boolean(currentPassword && currentPassword.trim()) ||
      Boolean(newPassword && newPassword.trim()) ||
      Boolean(confirmPassword && confirmPassword.trim());

    if (wantsPasswordChange) {
      if (!currentPassword?.trim() || !newPassword?.trim() || !confirmPassword?.trim()) {
        console.warn(`[auth] updateProfile rejected: missing password fields`, { userId });
        res
          .status(400)
          .json({ error: 'Pour changer ton mot de passe, indique le mot de passe actuel et le nouveau mot de passe.' });
        return;
      }
    }

    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      res.status(400).json({ error: 'Pour changer le mot de passe, remplis les deux champs.' });
      return;
    }

    if (newPassword && newPassword.length < 8) {
      console.warn(`[auth] updateProfile rejected: new password too short`, {
        userId,
      });
      res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
      return;
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      console.warn(`[auth] updateProfile rejected: password confirmation mismatch`, {
        userId,
      });
      res.status(400).json({ error: 'La confirmation ne correspond pas au nouveau mot de passe.' });
      return;
    }

    let passwordHash: string | undefined;

    if (currentPassword && newPassword) {
      const matches = await bcrypt.compare(currentPassword, current.password);
      if (!matches) {
        console.warn(`[auth] updateProfile rejected: current password mismatch`, { userId });
        res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
        return;
      }

      const isSamePassword = await bcrypt.compare(newPassword, current.password);
      if (isSamePassword) {
        console.warn(`[auth] updateProfile rejected: password unchanged`, { userId });
        res.status(400).json({ error: 'Indique un mot de passe différent de l’actuel.' });
        return;
      }

      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail !== undefined ? normalizedEmail : current.email,
        firstName: firstName ?? current.firstName,
        lastName: lastName ?? current.lastName,
        phone: normalizedPhone ?? current.phone,
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl ?? null } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
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