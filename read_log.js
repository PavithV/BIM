
const fs = require('fs');
// try reading as utf-16le
try {
    let content = fs.readFileSync('debug_log.txt', 'utf16le');
    if (!content.includes('Material ersetzt')) {
        // maybe it was utf8?
        content = fs.readFileSync('debug_log.txt', 'utf8');
    }
    const lines = content.split('\n').filter(l => l.includes('Material ersetzt'));
    console.log(lines.slice(0, 10).join('\n'));
} catch (e) { console.error(e); }
