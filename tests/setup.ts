/**
 * Test Setup File
 * 
 * Global test configuration and mocks
 */

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.SESSION_COOKIE_NAME = 'test_session';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'test';
process.env.MINIO_SECRET_KEY = 'test';
process.env.MINIO_BUCKET = 'test';
process.env.MINIO_USE_SSL = 'false';

// Global test utilities
export {};
