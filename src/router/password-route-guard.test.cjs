const fs = require('fs');
const path = require('path');
const routerPath = path.join(process.cwd(), 'src/router/index.ts');
const text = fs.readFileSync(routerPath, 'utf8');
const publicBlockMatch = text.match(/if \(to\.meta\.public\) \{[\s\S]*?\n  \}\n  if \(!authStore\.isAuthenticated\)/);
if (!publicBlockMatch) {
  console.error('FAIL: could not find public-route guard block');
  process.exit(2);
}
const publicBlock = publicBlockMatch[0];
if (/if \(authStore\.userInfo\?\.forcePasswordChange\) \{\s*next\('\/change-password'\)/.test(publicBlock) && !/to\.path !== '\/change-password'/.test(publicBlock)) {
  console.error('FAIL: authenticated forced-password user is redirected from /change-password to itself');
  process.exit(1);
}
console.log('PASS: change-password public route is not self-redirected');
