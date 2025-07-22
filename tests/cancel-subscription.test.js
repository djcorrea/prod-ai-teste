import assert from 'assert';
export default async function() {
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({project_id:'x',client_email:'x',private_key:'x'});
  global.__sets = {};
  const { default: handler } = await import('../api/user/cancel-subscription.js');
  const req = { method: 'POST', headers: { authorization: 'Bearer token' } };
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return { json: obj => { this.body = obj; }, end:()=>{} }; } };
  await handler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true });
  assert.strictEqual(global.__sets.testuid.status, 'cancelled');
  assert.ok('expiresAt' in global.__sets.testuid);
}
