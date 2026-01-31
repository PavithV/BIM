
import * as fs from 'fs';
import * as path from 'path';
import { compressIfcFile } from './ifcCompressor';

const files = ['KIT ifc.ifc', 'LCA_Building_01.ifc'];

files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        console.log(`\n--- Processing ${file} ---`);
        const content = fs.readFileSync(filePath, 'utf8');
        const compressed = compressIfcFile(content);

        // Print the first few lines of compressed output
        console.log("Output Preview:");
        console.log(compressed.split('\n').slice(0, 10).join('\n'));
    } else {
        console.log(`File ${file} not found.`);
    }
});
