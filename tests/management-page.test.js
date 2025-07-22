import assert from 'assert';
import fs from 'fs';
export default async function() {
  const html = fs.readFileSync('./public/gerenciar.html', 'utf8');
  assert.ok(html.includes('FREE MEMBER'), 'page should show FREE MEMBER');
}
