import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: config.isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
    ...(config.isDev ? [] : [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ]),
  ],
});
