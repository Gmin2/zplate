const fs = require('fs');
const path = require('path');

const sourceRoot = path.join(__dirname, '..');
const contentDir = path.join(__dirname, 'content');

if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
}

// Get all directories in sourceRoot
const dirs = fs.readdirSync(sourceRoot).filter(file => {
    return fs.statSync(path.join(sourceRoot, file)).isDirectory() && 
           file !== 'apps' && 
           file !== 'node_modules' &&
           !file.startsWith('.');
});

dirs.forEach(contractId => {
    const sourceBase = path.join(sourceRoot, contractId);
    const targetDir = path.join(contentDir, contractId);
    
    // Check if it looks like a contract project (has contracts or test folder)
    const hasContracts = fs.existsSync(path.join(sourceBase, 'contracts'));
    const hasTests = fs.existsSync(path.join(sourceBase, 'test'));
    
    if (!hasContracts && !hasTests) {
        return;
    }

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy README
    const readmePath = path.join(sourceBase, 'README.md');
    if (fs.existsSync(readmePath)) {
        fs.copyFileSync(readmePath, path.join(targetDir, 'README.md'));
        console.log(`Copied README for ${contractId}`);
    }

    // Copy Contracts
    if (hasContracts) {
        const contractsDir = path.join(sourceBase, 'contracts');
        const files = fs.readdirSync(contractsDir);
        files.forEach(file => {
            if (file.endsWith('.sol')) {
                fs.copyFileSync(path.join(contractsDir, file), path.join(targetDir, file));
                console.log(`Copied ${file} for ${contractId}`);
            }
        });
    }

    // Copy Tests
    if (hasTests) {
        const testsDir = path.join(sourceBase, 'test');
        const files = fs.readdirSync(testsDir);
        files.forEach(file => {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                fs.copyFileSync(path.join(testsDir, file), path.join(targetDir, file));
                console.log(`Copied ${file} for ${contractId}`);
            }
        });
    }
});

console.log('Migration complete.');
