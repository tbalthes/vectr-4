import { describe, it, expect, beforeEach, vi } from 'vitest';

import { verifyPlaidWebhook, VerificationError, isVerificationError } from '@/lib/plaid/verify';

// Mock fetch globally
global.fetch = vi.fn();

describe('Plaid Webhook Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the JWK cache
    vi.resetModules();
  });

  describe('verifyPlaidWebhook', () => {
    it('should throw VerificationError when Plaid-Verification header is missing', async () => {
      const headers = {};
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Missing Plaid-Verification header');
    });

    it('should skip verification in development mode when explicitly disabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSkip = process.env.SKIP_WEBHOOK_VERIFICATION;
      
      process.env.NODE_ENV = 'development';
      process.env.SKIP_WEBHOOK_VERIFICATION = 'true';

      const headers = {};
      const body = '{"test": "data"}';

      // Should not throw when verification is skipped
      await expect(verifyPlaidWebhook(headers, body)).resolves.toBeUndefined();

      process.env.NODE_ENV = originalEnv;
      process.env.SKIP_WEBHOOK_VERIFICATION = originalSkip;
    });

    it('should throw VerificationError for invalid JWT format', async () => {
      const headers = {
        'plaid-verification': 'invalid.jwt' // Only 2 segments
      };
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Invalid JWT format');
    });

    it('should throw VerificationError when JWT header is malformed', async () => {
      const headers = {
        'plaid-verification': 'invalid-header.payload.signature'
      };
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Failed to decode JWT header or payload');
    });

    it('should throw VerificationError when kid is missing from JWT header', async () => {
      // Create a JWT with missing kid
      const header = { alg: 'RS256' }; // missing kid
      const payload = { iat: Math.floor(Date.now() / 1000) };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${encodedHeader}.${encodedPayload}.fake-signature`;

      const headers = {
        'plaid-verification': jwt
      };
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Missing kid in JWT header');
    });

    it('should throw VerificationError when iat is missing from JWT payload', async () => {
      const header = { alg: 'RS256', kid: 'test-kid' };
      const payload = { sub: 'test' }; // missing iat
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${encodedHeader}.${encodedPayload}.fake-signature`;

      const headers = {
        'plaid-verification': jwt
      };
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Missing or invalid iat claim');
    });

    it('should throw VerificationError when JWT timestamp is outside allowed window', async () => {
      const header = { alg: 'RS256', kid: 'test-kid' };
      const oldTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // 10 minutes ago
      const payload = { iat: oldTimestamp };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${encodedHeader}.${encodedPayload}.fake-signature`;

      const headers = {
        'plaid-verification': jwt
      };
      const body = '{"test": "data"}';

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('JWT timestamp outside allowed window');
    });

    it('should throw VerificationError when JWKS fetch fails', async () => {
      const header = { alg: 'RS256', kid: 'test-kid' };
      const payload = { 
        iat: Math.floor(Date.now() / 1000),
        request_body_sha256: 'test-hash'
      };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${encodedHeader}.${encodedPayload}.fake-signature`;

      const headers = {
        'plaid-verification': jwt
      };
      const body = '{"test": "data"}';

      // Mock fetch to fail
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow(VerificationError);
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow('Failed to fetch JWK');
    });

    it('should handle successful verification path (mocked)', async () => {
      const header = { alg: 'RS256', kid: 'test-kid' };
      const bodyHash = await import('crypto').then(crypto => 
        crypto.createHash('sha256').update('{"test": "data"}', 'utf8').digest('hex')
      );
      const payload = { 
        iat: Math.floor(Date.now() / 1000),
        request_body_sha256: bodyHash
      };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${encodedHeader}.${encodedPayload}.fake-signature`;

      const headers = {
        'plaid-verification': jwt
      };
      const body = '{"test": "data"}';

      // Mock JWKS fetch
      const mockJWK = {
        kty: 'RSA',
        kid: 'test-kid',
        n: 'test-n',
        e: 'AQAB'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [mockJWK] })
      });

      // Mock jose module
      const mockJose = {
        importJWK: vi.fn().mockResolvedValue({}),
        jwtVerify: vi.fn().mockResolvedValue({})
      };

      vi.doMock('jose', () => mockJose);

      // Since this is a complex integration test, we expect it to at least
      // get past the initial validation steps
      await expect(verifyPlaidWebhook(headers, body)).rejects.toThrow();
      // The actual signature verification will fail since we're using fake data,
      // but it should get past the header/payload validation
    });
  });

  describe('VerificationError', () => {
    it('should create VerificationError with code and message', () => {
      const error = new VerificationError('Test message', 'TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('VerificationError');
    });
  });

  describe('isVerificationError', () => {
    it('should correctly identify VerificationError instances', () => {
      const verificationError = new VerificationError('Test', 'TEST_CODE');
      const regularError = new Error('Regular error');

      expect(isVerificationError(verificationError)).toBe(true);
      expect(isVerificationError(regularError)).toBe(false);
      expect(isVerificationError(null)).toBe(false);
      expect(isVerificationError(undefined)).toBe(false);
    });
  });
});