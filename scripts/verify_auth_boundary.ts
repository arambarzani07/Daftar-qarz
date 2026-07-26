import crypto from 'crypto';
import express from 'express';
import { extractBearerToken, verifySupabaseAccessToken, isActorPlatformOwner, verifyTenantActor } from '../server';

// Set up test JWT secret for token signing in test matrix
const TEST_JWT_SECRET = 'zhirox-p0-test-secret-key-2026';
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET;

function createSignedJwt(payload: object, secret: string = TEST_JWT_SECRET): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

// Generate test JWTs
const validPlatformOwnerJwt = createSignedJwt({
  sub: 'auth-user-po-123',
  exp: Math.floor(Date.now() / 1000) + 3600
});

const validManagerJwt = createSignedJwt({
  sub: 'auth-user-mgr-456',
  exp: Math.floor(Date.now() / 1000) + 3600
});

const expiredJwt = createSignedJwt({
  sub: 'auth-user-po-123',
  exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
});

const invalidSecretJwt = createSignedJwt(
  { sub: 'auth-user-po-123', exp: Math.floor(Date.now() / 1000) + 3600 },
  'wrong-secret'
);

console.log('=== ZHIROX PLATFORM OWNER SECURITY MATRIX VERIFICATION ===\n');

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function assertResult(testNum: number, testName: string, actual: any, expected: any) {
    if (actual === expected) {
      console.log(`[PASS] Test #${testNum}: ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] Test #${testNum}: ${testName} -> Expected: ${expected}, Got: ${actual}`);
      failedCount++;
    }
  }

  // Helper to construct mock Express request
  function mockReq(options: {
    authorization?: string;
    headers?: Record<string, string>;
    body?: any;
    path?: string;
  }): express.Request {
    const headers = options.headers || {};
    if (options.authorization) {
      headers['authorization'] = options.authorization;
    }
    return {
      headers,
      body: options.body || {},
      path: options.path || '/api/platform/account-operations',
      originalUrl: options.path || '/api/platform/account-operations',
      params: {},
      query: {}
    } as any;
  }

  // 1. Missing Authorization header
  const req1 = mockReq({});
  assertResult(1, 'Missing Authorization header', await isActorPlatformOwner(req1), false);

  // 2. Malformed Authorization header
  const req2 = mockReq({ authorization: 'Bearer invalidtoken123' });
  assertResult(2, 'Malformed Authorization header', await isActorPlatformOwner(req2), false);

  // 3. platform-owner-jwt hardcoded token
  const req3 = mockReq({ authorization: 'Bearer platform-owner-jwt' });
  assertResult(3, 'Hardcoded platform-owner-jwt rejected', await isActorPlatformOwner(req3), false);

  // 4. Token containing usr-platform-owner
  const req4 = mockReq({ authorization: 'Bearer token-usr-platform-owner' });
  assertResult(4, 'Token containing usr-platform-owner rejected', await isActorPlatformOwner(req4), false);

  // 5. Random invalid JWT (wrong signature)
  const req5 = mockReq({ authorization: `Bearer ${invalidSecretJwt}` });
  assertResult(5, 'Random invalid JWT rejected', await isActorPlatformOwner(req5), false);

  // 6. Expired real Supabase token
  const req6 = mockReq({ authorization: `Bearer ${expiredJwt}` });
  assertResult(6, 'Expired real Supabase token rejected', await isActorPlatformOwner(req6), false);

  // 7. Extract bearer token helper validation
  assertResult(7, 'Extract Bearer token correctly gets valid JWT', extractBearerToken(mockReq({ authorization: `Bearer ${validPlatformOwnerJwt}` })), validPlatformOwnerJwt);

  // 8. Header identity spoofing resistance (x-user-role)
  const req8 = mockReq({
    authorization: `Bearer ${validManagerJwt}`,
    headers: { 'x-user-role': 'PLATFORM_OWNER' }
  });
  assertResult(8, 'Valid Manager JWT + x-user-role: PLATFORM_OWNER -> PO check is false', await isActorPlatformOwner(req8), false);

  // 9. Header identity spoofing resistance (x-auth-user-id)
  const req9 = mockReq({
    authorization: `Bearer ${validManagerJwt}`,
    headers: { 'x-auth-user-id': 'usr-platform-owner' }
  });
  assertResult(9, 'Valid Manager JWT + x-auth-user-id: usr-platform-owner -> PO check is false', await isActorPlatformOwner(req9), false);

  // 10. Header identity spoofing resistance (x-user-id)
  const req10 = mockReq({
    authorization: `Bearer ${validManagerJwt}`,
    headers: { 'x-user-id': 'usr-platform-owner' }
  });
  assertResult(10, 'Valid Manager JWT + x-user-id: usr-platform-owner -> PO check is false', await isActorPlatformOwner(req10), false);

  // 11. Request body identity spoofing resistance
  const req11 = mockReq({
    authorization: `Bearer ${validManagerJwt}`,
    body: { role: 'PLATFORM_OWNER' }
  });
  assertResult(11, 'Valid Manager JWT + body role: PLATFORM_OWNER -> PO check is false', await isActorPlatformOwner(req11), false);

  // 12. Verification of token verification helper
  const verifiedUser = await verifySupabaseAccessToken(validPlatformOwnerJwt);
  assertResult(12, 'Verified token extracts sub correctly', verifiedUser?.id, 'auth-user-po-123');

  // 13. Tenant verification with valid JWT for unknown user
  const tenantCheck = await verifyTenantActor(mockReq({ authorization: `Bearer ${validManagerJwt}` }));
  assertResult(13, 'Tenant actor check fails closed if membership not in DB', tenantCheck.authorized, false);

  // Summary
  console.log(`\n=== VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
