/**
 * Test Setup File
 * 
 * Global test configuration and mocks
 */

// Mock environment variables for tests
// @ts-ignore - Allow setting NODE_ENV for tests
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only-must-be-32-chars-long';
process.env.SESSION_COOKIE_NAME = 'test_session';
process.env.S3_ENDPOINT = 'localhost';
process.env.S3_PORT = '9000';
process.env.S3_ACCESS_KEY = 'mobifaktura_s3_internal';
process.env.S3_SECRET_KEY = 'mobifaktura_s3_secret_key_2026';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_USE_SSL = 'false';
process.env.S3_REGION = 'eu-central-1';

// Additional environment variables for comprehensive testing
process.env.COOKIE_DOMAIN = 'localhost';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Global test utilities
export {};

