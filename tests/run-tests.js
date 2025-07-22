import fs from 'fs';
import assert from 'assert';

function testCancelButton() {
  const html = fs.readFileSync('public/gerenciar.html', 'utf8');
  assert(/onclick="cancelarAssinatura\(\)"/.test(html), 'cancelarAssinatura button missing');
  assert(/function cancelarAssinatura\(\)/.test(html), 'cancelarAssinatura function missing');
  assert(/function cancelSubscription\(\)/.test(html), 'cancelSubscription function missing');
  assert(/apiRequest\('\/api\/user\/cancel-subscription'/.test(html), 'API call missing');
  const defs = html.match(/function confirmCancel\(/g) || [];
  assert(defs.length === 1, 'confirmCancel duplicated');
  assert(!/FREE MEMBER/.test(html), 'premature badge update');
}

function testApiFile() {
  const js = fs.readFileSync('api/user/cancel-subscription.js', 'utf8');
  assert(/MercadoPagoConfig/.test(js), 'MercadoPago integration missing');
  assert(/expiresAt/.test(js), 'expiresAt field not handled');
}

try {
  testCancelButton();
  testApiFile();
  console.log('All tests passed!');
} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
}
