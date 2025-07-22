import fs from 'fs';
let passed = 0, failed = 0;
for (const file of fs.readdirSync('./tests')) {
  if (file.endsWith('.test.js')) {
    try {
      const mod = await import(`./${file}`);
      await mod.default();
      console.log('✓', file);
      passed++;
    } catch (err) {
      console.error('✗', file, err.message);
      failed++;
    }
  }
}
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
