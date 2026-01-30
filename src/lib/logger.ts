import 'server-only';
import pino from 'pino';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
}

// Create logger instance with structured logging
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  
  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
    service: 'mobifaktura',
  },

  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

// Child loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Specific loggers for different parts of the app
export const authLogger = createModuleLogger('auth');
export const dbLogger = createModuleLogger('database');
export const apiLogger = createModuleLogger('api');
export const cronLogger = createModuleLogger('cron');
export const storageLogger = createModuleLogger('storage');
export const trpcLogger = createModuleLogger('trpc');

// Helper functions for common logging patterns
export const logError = (error: unknown, context?: Record<string, unknown>) => {
  if (error instanceof Error) {
    logger.error({
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    });
  } else {
    logger.error({
      err: String(error),
      ...context,
    });
  }
};

export const logRequest = (
  method: string,
  path: string,
  duration: number,
  statusCode: number,
  context?: Record<string, unknown>
) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger[level]({
    type: 'request',
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    ...context,
  });
};

export const logAuth = (
  action: 'login' | 'logout' | 'register' | 'failed-login' | 'session-check',
  userId?: string,
  context?: Record<string, unknown>
) => {
  authLogger.info({
    action,
    userId,
    ...context,
  });
};

export const logDatabase = (
  operation: 'query' | 'insert' | 'update' | 'delete' | 'connection',
  table?: string,
  duration?: number,
  context?: Record<string, unknown>
) => {
  dbLogger.info({
    operation,
    table,
    ...(duration && { duration: `${duration}ms` }),
    ...context,
  });
};

export const logCron = (
  job: string,
  status: 'started' | 'completed' | 'failed',
  duration?: number,
  context?: Record<string, unknown>
) => {
  const level = status === 'failed' ? 'error' : 'info';
  
  cronLogger[level]({
    job,
    status,
    ...(duration && { duration: `${duration}ms` }),
    ...context,
  });
};

export const logStorage = (
  operation: 'upload' | 'download' | 'delete' | 'list' | 'create_bucket' | 'error',
  bucket?: string,
  file?: string,
  context?: Record<string, unknown>
) => {
  storageLogger.info({
    operation,
    bucket,
    file,
    ...context,
  });
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  context?: Record<string, unknown>
) => {
  const level = duration > 1000 ? 'warn' : 'info';
  
  logger[level]({
    type: 'performance',
    operation,
    duration: `${duration}ms`,
    ...context,
  });
};

// Business event logging
export const logEvent = (
  event: string,
  userId?: string,
  context?: Record<string, unknown>
) => {
  logger.info({
    type: 'event',
    event,
    userId,
    ...context,
  });
};

// Export types for TypeScript
export type Logger = typeof logger;
export type ModuleLogger = ReturnType<typeof createModuleLogger>;
