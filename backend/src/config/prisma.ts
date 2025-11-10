import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const ensureDatabaseUrl = (): void => {
  if (process.env.DATABASE_URL) {
    return;
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user) {
    console.warn(
      'DATABASE_URL non défini et informations DB_* incomplètes. Prisma risque d’échouer à se connecter.'
    );
    return;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = password ? `:${encodeURIComponent(password)}` : '';
  const authority = `${encodedUser}${encodedPassword}@${host}:${port}`;

  process.env.DATABASE_URL = `postgresql://${authority}/${database}?schema=public`;
};

ensureDatabaseUrl();

const prisma = new PrismaClient();

export default prisma;

