const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'frontend');
const outputDir = path.join(__dirname, '..', 'dist');

fs.rmSync(outputDir, { recursive: true, force: true });

const staticEntries = ['index.html', 'page2.html', 'assets', 'content'];

for (const entry of staticEntries) {
  const sourcePath = path.join(sourceDir, entry);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }

  const targetPath = path.join(outputDir, entry);
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

console.log(`Copied ${sourceDir} -> ${outputDir}`);
