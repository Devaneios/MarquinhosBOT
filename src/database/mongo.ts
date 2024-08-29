import mongoose from 'mongoose';
import { logger } from '@utils/logger';

export const mongoConnection = async () => {
  const MONGO_URI = process.env.MARQUINHOS_MONGO_URI;
  const MONGO_DATABASE_NAME = process.env.MARQUINHOS_MONGO_DATABASE_NAME;
  if (!MONGO_URI) return logger.info(`Mongo URI not found`);
  if (!MONGO_DATABASE_NAME) return logger.info(`Mongo database name not found`);
  try {
    const mongoConnection = await mongoose.connect(
      `${MONGO_URI}/${MONGO_DATABASE_NAME}`
    );
    if (!mongoConnection) throw new Error('MongoDB connection failed');
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error}`);
  }
};
