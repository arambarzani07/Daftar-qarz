import { verifyTenantPermission, APPROVED_PERMISSIONS } from '../server';

let passedCount = 0;
let failedCount = 0;

function assertResult(testNum: number, description: string, actual: any, expected: any) {
  if (actual === expected) {
    console.log(`[PASS] Test #${testNum}: ${description}`);
    passedCount++;
  } else {
    console.error(`[FAIL] Test #${testNum}: ${description}`);
    console.error(`       Expected: ${JSON.stringify(expected)}`);
    console.error(`       Actual:   ${JSON.stringify(actual)}`);
    failedCount++;
  }
}

function mockReqRes(headers: Record<string, string> = {}) {
  const req: any = {
    headers: { ...headers },
    params: {},
    query: {},
    body: {}
  };
  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('=== ZHIROX EMPLOYEE PERMISSION CENTER VERIFICATION ===\n');

  // 1. Verify APPROVED_PERMISSIONS list
  assertResult(1, 'Approved permissions list matches exact 7 keys', APPROVED_PERMISSIONS.join(','), 'ADD_DEBT,RECEIVE_PAYMENT,ADD_CUSTOMER,REVERSE_TRANSACTION,VIEW_ANALYTICS,EXPORT_STATEMENTS,MANAGE_CREDIT_LIMIT');

  // 2. Employee with ACTIVE status and ADD_CUSTOMER permission -> PASS
  const ctx2 = mockReqRes({
    'x-user-role': 'EMPLOYEE',
    'x-membership-status': 'ACTIVE',
    'x-user-permissions': 'ADD_CUSTOMER,ADD_DEBT'
  });
  const res2 = await verifyTenantPermission(ctx2.req, ctx2.res, 'ADD_CUSTOMER');
  assertResult(2, 'Active employee with ADD_CUSTOMER permission is authorized', res2.authorized, true);

  // 3. Employee with ACTIVE status without REVERSE_TRANSACTION permission -> 403
  const ctx3 = mockReqRes({
    'x-user-role': 'EMPLOYEE',
    'x-membership-status': 'ACTIVE',
    'x-user-permissions': 'ADD_CUSTOMER,ADD_DEBT'
  });
  const res3 = await verifyTenantPermission(ctx3.req, ctx3.res, 'REVERSE_TRANSACTION');
  assertResult(3, 'Active employee without REVERSE_TRANSACTION receives 403 Forbidden', res3.authorized, false);
  assertResult(3.1, 'HTTP Status is 403 Forbidden', ctx3.getStatus(), 403);

  // 4. Employee with PENDING_ACTIVATION status -> 403
  const ctx4 = mockReqRes({
    'x-user-role': 'EMPLOYEE',
    'x-membership-status': 'PENDING_ACTIVATION',
    'x-user-permissions': 'ADD_CUSTOMER,ADD_DEBT,RECEIVE_PAYMENT'
  });
  const res4 = await verifyTenantPermission(ctx4.req, ctx4.res, 'ADD_CUSTOMER');
  assertResult(4, 'PENDING_ACTIVATION employee is denied access (403)', res4.authorized, false);
  assertResult(4.1, 'HTTP Status is 403 Forbidden', ctx4.getStatus(), 403);

  // 5. Employee with SUSPENDED status -> 403
  const ctx5 = mockReqRes({
    'x-user-role': 'EMPLOYEE',
    'x-membership-status': 'SUSPENDED',
    'x-user-permissions': 'ADD_CUSTOMER,ADD_DEBT,RECEIVE_PAYMENT'
  });
  const res5 = await verifyTenantPermission(ctx5.req, ctx5.res, 'ADD_DEBT');
  assertResult(5, 'SUSPENDED employee is denied access (403)', res5.authorized, false);
  assertResult(5.1, 'HTTP Status is 403 Forbidden', ctx5.getStatus(), 403);

  // 6. Employee with REVOKED status -> 403
  const ctx6 = mockReqRes({
    'x-user-role': 'EMPLOYEE',
    'x-membership-status': 'REVOKED',
    'x-user-permissions': 'ADD_CUSTOMER,ADD_DEBT,RECEIVE_PAYMENT,REVERSE_TRANSACTION'
  });
  const res6 = await verifyTenantPermission(ctx6.req, ctx6.res, 'RECEIVE_PAYMENT');
  assertResult(6, 'REVOKED employee is denied access (403)', res6.authorized, false);
  assertResult(6.1, 'HTTP Status is 403 Forbidden', ctx6.getStatus(), 403);

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
