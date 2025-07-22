import assert from 'assert';
export default async function() {
  const mod = await import('../functions/index.js');
  assert.ok(mod.expireSubscriptions, 'expireSubscriptions function exists');
  // Setup mock data
  global.__data = {user1: {plano: 'plus', expiresAt: Date.now() - 1000}};
  await mod.expireSubscriptions();
  assert.strictEqual(global.__data.user1.plano, 'gratis');
}
