import mongoose from 'mongoose';
import { logger } from './logger';

export const mongoConnection = async () => {
  const MONGO_URI = process.env.MONGO_URI;
  const MONGO_DATABASE_NAME = process.env.MONGO_DATABASE_NAME;
  if (!MONGO_URI) return logger.info(`Mongo URI not found`);
  if (!MONGO_DATABASE_NAME) return logger.info(`Mongo database name not found`);
  return await mongoose
    .connect(`${MONGO_URI}/${MONGO_DATABASE_NAME}`)
    .then(() => logger.info('MongoDB connection has been established.'))
    .catch((error) => {
      logger.error('MongoDB connection has been failed');
      logger.error(error);
    });
};
