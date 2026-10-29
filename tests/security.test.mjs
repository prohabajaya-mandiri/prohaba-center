import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { canAccess, isSameOriginMutation, ROLES } from '../src/lib/access.js';
import { payrollTransition } from '../src/lib/payroll-approval.js';
import { GET as seed } from '../src/app/api/seed/route.js';

test('module permissions reject privilege escalation and unknown routes', () => {
  for (const role of ROLES) assert.equal(canAccess(role, '/api/users', 'POST'), role === 'TOP_MANAGEMENT');
  assert.equal(canAccess('WORKSHOP', '/api/payroll/approve', 'POST'), false);
  assert.equal(canAccess('FINANCE', '/api/boq/item', 'POST'), false);
  assert.equal(canAccess('FINANCE', '/api/boq/actual', 'GET'), true);
  assert.equal(canAccess('TOP_MANAGEMENT', '/api/unknown', 'POST'), false);
  assert.equal(canAccess('GUEST', '/dashboard'), false);
});
test('cross-origin mutations are rejected', () => {
  const request = (origin) => new Request('https://erp.example/api/projects', { method: 'POST', headers: { origin } });
  assert.equal(isSameOriginMutation(request('https://attacker.example')), false);
  assert.equal(isSameOriginMutation(request('https://erp.example')), true);
  const previous=process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(isSameOriginMutation(new Request('http://localhost:3101/api/documents', {
      method: 'POST', headers: { origin: 'http://127.0.0.1:3101', host: '127.0.0.1:3101' },
    })), true);
    process.env.VERCEL='1';
    assert.equal(isSameOriginMutation(new Request('http://internal/api/documents', {
      method: 'POST', headers: {origin:'https://erp.example',host:'erp.example'},
    })),true);
    assert.equal(isSameOriginMutation(new Request('http://internal/api/documents', {
      method:'POST',headers:{origin:'http://erp.example',host:'erp.example'},
    })),false);
  } finally {if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;}
});
test('payroll approvals require the matching role and transition', () => {
  assert.equal(payrollTransition('PJO', 'TOP_APPROVE'), null);
  assert.equal(payrollTransition('HRD', 'FINANCE_APPROVE'), null);
  assert.equal(payrollTransition('HRD', 'HRD_APPROVE').from, 'SUBMITTED');
  assert.equal(payrollTransition('TOP_MANAGEMENT', '__proto__'), null);
});
test('every business API handler has an authorization check', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]);
  for (const file of walk('src/app/api').filter(f => f.endsWith('/route.js') && !f.includes('/auth/') && !f.includes('/seed/'))) {
    const source = readFileSync(file, 'utf8');
    // Route yang dibaca E-HSE memakai tanda tangan HMAC, bukan sesi.
    if (file.includes('/api/integration/')) {
      assert.ok(/=\s*hseIntegrationApi\(/.test(source) && !/export (async )?function (GET|POST|PUT|DELETE)/.test(source), file);
      continue;
    }
    assert.ok(source.includes('authorizeApi(') || /api\(/.test(source) || /export \{ (GET|POST)/.test(source), file);
  }
});
test('HTTP seed cannot delete data', async () => assert.equal((await seed()).status, 410));
