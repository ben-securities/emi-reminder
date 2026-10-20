const fs = require('fs');
const html = fs.readFileSync('D:/Projects/ios-reminder-app/index.html', 'utf8');
const js = fs.readFileSync('D:/Projects/ios-reminder-app/app.js', 'utf8');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(js)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    missing.push(id);
  }
}

console.log('Total checked IDs:', ids.size);
console.log('Missing IDs in index.html:', missing);
