
const fs = require('fs');
const content = fs.readFileSync('OBD.csv', 'utf8');
const firstLine = content.split('\n')[0];
console.log(firstLine);
