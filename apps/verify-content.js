const fs = require('fs');
const path = require('path');

// Mock data.ts content since we can't import TS directly easily in simple node script without setup
// I'll just read the file and regex extract IDs
const dataTsPath = path.join(__dirname, 'app/hub/data.ts');
const dataTsContent = fs.readFileSync(dataTsPath, 'utf8');
const idMatches = dataTsContent.match(/id: "([^"]+)"/g);
const ids = idMatches.map(m => m.match(/"([^"]+)"/)[1]);

console.log(`Found ${ids.length} contracts in data.ts`);

const contentDir = path.join(__dirname, 'content');
let errors = 0;

ids.forEach(id => {
    const dir = path.join(contentDir, id);
    if (!fs.existsSync(dir)) {
        console.error(`MISSING CONTENT DIRECTORY: ${id}`);
        errors++;
        return;
    }

    const readmePath = path.join(dir, 'README.md');
    if (!fs.existsSync(readmePath)) {
        console.warn(`Missing README for ${id}`);
    } else {
        // console.log(`OK: README for ${id}`);
    }

    const files = fs.readdirSync(dir).filter(f => f !== 'README.md');
    if (files.length === 0) {
        console.warn(`No code files for ${id}`);
    } else {
        // console.log(`OK: ${files.length} files for ${id}`);
    }
});

if (errors === 0) {
    console.log('Verification PASSED: All contracts have content directories.');
} else {
    console.error(`Verification FAILED: ${errors} missing directories.`);
    process.exit(1);
}
