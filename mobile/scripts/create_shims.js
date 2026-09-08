const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const libDir = path.resolve(__dirname, '../node_modules/react-native/Libraries');
console.log('Scanning directory:', libDir);

const allFiles = walkDir(libDir);
const androidOrIosFiles = allFiles.filter(f => f.endsWith('.android.js') || f.endsWith('.ios.js'));

const created = [];
for (const f of androidOrIosFiles) {
  const baseName = f.replace(/\.(android|ios)\.js$/, '');
  const webFile = baseName + '.web.js';
  const plainFile = baseName + '.js';

  if (!fs.existsSync(webFile) && !fs.existsSync(plainFile)) {
    const name = path.basename(baseName);
    const content = `const rnw = require('react-native-web');
const exported = rnw['${name}'] || rnw.default || function ${name}() {};
module.exports = exported;
`;
    fs.writeFileSync(webFile, content, 'utf8');
    created.push(path.basename(webFile));
  }
}

console.log(`Successfully created ${created.length} missing web shims!`, created);
