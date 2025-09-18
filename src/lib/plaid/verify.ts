import 'server-only';

/**
 * Plaid JWS/PS256 signature verification utility
 * 
 * This module encapsulates JWS/PS256 signature verification using the Plaid public key(s)
 * and timestamp checks as outlined in WBS section 2.1.1
 */

// Cache for JWK keys to avoid repeated fetches
const jwkCache = new Map<string, { jwk: any; expiresAt: number }>();
const JWK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Plaid JWKS URLs by environment
const PLAID_JWKS_URLS = {
  sandbox: 'https://production.plaid.com/v1/jwks',
  development: 'https://production.plaid.com/v1/jwks', 
  production: 'https://production.plaid.com/v1/jwks'
};

interface PlaidWebhookHeaders {
  'plaid-verification'?: string;
  [key: string]: string | undefined;
}

/**
 * Verification error class for webhook verification failures
 */
export class VerificationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

/**
 * Fetch JWK from Plaid JWKS endpoint with caching
 */
async function fetchJWK(kid: string): Promise<any> {
  const cached = jwkCache.get(kid);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.jwk;
  }

  const env = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PLAID_JWKS_URLS;
  const jwksUrl = process.env.PLAID_JWKS_URL || PLAID_JWKS_URLS[env];

  try {
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new VerificationError(`JWKS fetch failed: ${response.status}`, 'JWKS_FETCH_ERROR');
    }

    const jwks = await response.json();
    const jwk = jwks.keys?.find((key: any) => key.kid === kid);
    
    if (!jwk) {
      throw new VerificationError(`JWK not found for kid: ${kid}`, 'JWK_NOT_FOUND');
    }

    // Cache the JWK
    jwkCache.set(kid, {
      jwk,
      expiresAt: Date.now() + JWK_CACHE_TTL_MS
    });

    return jwk;
  } catch (_) {
    if (_ instanceof VerificationError) {
      throw _;
    }
    throw new VerificationError(`Failed to fetch JWK: ${String(_)}`, 'JWKS_FETCH_ERROR');
  }
}

/**
 * Convert base64url to base64
 */
function base64UrlToBase64(b64url: string): string {
  return b64url.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (b64url.length % 4)) % 4);
}

/**
 * Verify Plaid webhook using JWS/PS256 signature verification
 * 
 * @param headers - Request headers including 'plaid-verification'
 * @param body - Raw request body as string
 * @throws VerificationError on failure
 * @returns Promise<void> - resolves if verification succeeds
 */
export async function verifyPlaidWebhook(
  headers: PlaidWebhookHeaders,
  body: string
): Promise<void> {
  const verificationHeader = headers['plaid-verification'];
  
  if (!verificationHeader) {
    throw new VerificationError('Missing Plaid-Verification header', 'MISSING_HEADER');
  }

  // Skip verification in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
    return;
  }

  const segments = verificationHeader.split('.');
  if (segments.length !== 3) {
    throw new VerificationError('Invalid JWT format in Plaid-Verification header', 'INVALID_JWT_FORMAT');
  }

  let headerJson: any;
  let payloadJson: any;

  try {
    headerJson = JSON.parse(
      Buffer.from(base64UrlToBase64(segments[0]), 'base64').toString('utf8')
    );
    payloadJson = JSON.parse(
      Buffer.from(base64UrlToBase64(segments[1]), 'base64').toString('utf8')
    );
  } catch {
    throw new VerificationError('Failed to decode JWT header or payload', 'JWT_DECODE_ERROR');
  }

  const kid = headerJson.kid;
  if (!kid) {
    throw new VerificationError('Missing kid in JWT header', 'MISSING_KID');
  }

  // Check timestamp for replay protection (5 minutes window)
  const iat = payloadJson.iat;
  if (!iat || typeof iat !== 'number') {
    throw new VerificationError('Missing or invalid iat claim', 'MISSING_IAT');
  }

  const issuedAt = new Date(iat * 1000);
  const now = new Date();
  const fiveMinutesMs = 5 * 60 * 1000;
  
  if (Math.abs(now.getTime() - issuedAt.getTime()) > fiveMinutesMs) {
    throw new VerificationError('JWT timestamp outside allowed window', 'TIMESTAMP_OUT_OF_RANGE');
  }

  // Verify request body integrity
  const expectedBodyHash = payloadJson.request_body_sha256;
  if (expectedBodyHash) {
    const crypto = await import('crypto');
    const actualBodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
    
    if (actualBodyHash !== expectedBodyHash) {
      throw new VerificationError('Request body hash mismatch', 'BODY_HASH_MISMATCH');
    }
  }

  // Verify signature using jose library
  try {
    const jose = await import('jose');
    const jwk = await fetchJWK(kid);
    const jwkKey = await jose.importJWK(jwk);
    
    await jose.jwtVerify(verificationHeader, jwkKey, {
      maxTokenAge: '5m',
    });
  } catch (_error) {
    // Fallback to manual verification if jose fails
    try {
      const jwk = await fetchJWK(kid);
      
      // Convert JWK to PEM (simplified - in production use a proper JWK to PEM converter)
      if (jwk.kty !== 'RSA') {
        throw new VerificationError('Unsupported key type, expected RSA', 'UNSUPPORTED_KEY_TYPE');
      }

      // For now, throw the jose error since manual verification is complex
      throw new VerificationError(`JWT verification failed: ${String(_error)}`, 'SIGNATURE_VERIFICATION_FAILED');
    } catch (fallbackError) {
      if (fallbackError instanceof VerificationError) {
        throw fallbackError;
      }
      throw new VerificationError(`Fallback verification failed: ${String(fallbackError)}`, 'VERIFICATION_FAILED');
    }
  }
}

/**
 * Type guard to check if error is a VerificationError
 */
export function isVerificationError(error: any): error is VerificationError {
  return error instanceof VerificationError;
}