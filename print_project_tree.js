import fs from 'fs';
import path from 'path';

const EXCLUDE = ['node_modules', '.next', '.vscode', '.git', '.DS_Store', '.env', 'dist', 'build', '__pycache__'];
const OUTPUT_FILE = 'project_tree.txt';
let outputLines = [];

function printTree(dir, prefix = '') {
  const files = fs.readdirSync(dir).filter(f => !EXCLUDE.includes(f));
  files.sort((a, b) => a.localeCompare(b));
  files.forEach((file, idx) => {
    const fullPath = path.join(dir, file);
    const isDir = fs.statSync(fullPath).isDirectory();
    const isLast = idx === files.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    outputLines.push(prefix + connector + file);
    if (isDir) {
      printTree(fullPath, prefix + (isLast ? '    ' : '│   '));
    }
  });
}

outputLines.push('vectr-4');
printTree(process.cwd());
fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'), 'utf8');
console.log(`Project tree written to ${OUTPUT_FILE}`);
