import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error', 'warn'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to MySQL database via Prisma.');
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error);
    process.exit(1);
  }
}
