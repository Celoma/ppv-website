const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'frontend');
const outputDir = path.join(__dirname, '..', 'dist');

function copyRecursive(source, target) {
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      if (entry === 'dist') {
        continue;
      }

      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(outputDir, { recursive: true, force: true });
copyRecursive(sourceDir, outputDir);
console.log(`Copied ${sourceDir} -> ${outputDir}`);
