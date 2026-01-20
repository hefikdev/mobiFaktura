/**
 * Test Setup File
 * 
 * Global test configuration and mocks
 */

// Mock environment variables for tests
// NODE_ENV is set by the test runner
(process.env as any).NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only-must-be-32-chars-long';
process.env.SESSION_COOKIE_NAME = 'test_session';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'test-access-key';
process.env.MINIO_SECRET_KEY = 'test-secret-key';
process.env.MINIO_BUCKET = 'test-bucket';
process.env.MINIO_USE_SSL = 'false';

// Additional environment variables for comprehensive testing
process.env.COOKIE_DOMAIN = 'localhost';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Global test utilities
export {};

