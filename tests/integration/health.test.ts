import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Health Check API Tests
 * 
 * Tests the /api/health endpoint
 */
describe('Health Check API', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

  describe('GET /api/health', () => {
    it('should return 200 status', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
    });

    it('should return JSON response', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const contentType = response.headers.get('content-type');
      
      expect(contentType).toContain('application/json');
    });

    it('should return health status', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('healthy');
    });

    it('should return timestamp', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should return checks object', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data).toHaveProperty('checks');
      expect(typeof data.checks).toBe('object');
    });

    it('should include database check', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data.checks).toHaveProperty('database');
    });

    it('should include uptime', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data).toHaveProperty('uptime');
      expect(typeof data.uptime).toBe('number');
    });

    it('should include response time', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data).toHaveProperty('responseTime');
      expect(data.responseTime).toMatch(/\d+ms/);
    });

    it('should have cache-control header', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const cacheControl = response.headers.get('cache-control');
      
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toContain('no-cache');
    });
  });
});
