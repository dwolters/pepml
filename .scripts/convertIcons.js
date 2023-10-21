const fs = require('fs');
const path = require('path');

const directoryPath = 'src/assets/icons';
const outputPath = 'src/modules/icons.ts';

// Function to convert file content to base64
const convertToBase64 = (filepath) => {
    const fileContent = fs.readFileSync(filepath);
    return Buffer.from(fileContent).toString('base64');
};

// Read all files in the directory
fs.readdir(directoryPath, (err, files) => {
    if (err) {
        console.error(`Error reading directory: ${err}`);
        return;
    }

    const exportsObject = {};

    files.forEach(file => {
        const filePath = path.join(directoryPath, file);
        const fileStat = fs.statSync(filePath);

        // Check if it's a file and not a directory
        if (fileStat.isFile()) {
            const fileNameWithoutExt = path.parse(file).name;
            //exportsObject[fileNameWithoutExt] = 'data:image/svg+xml;base64,' + convertToBase64(filePath);
            exportsObject[fileNameWithoutExt] = 'https://dwolt.de/pepml/assets/' + file;
        }
    });

    const moduleContent = `export default ${JSON.stringify(exportsObject, null, 2)};`;
    fs.writeFileSync(outputPath, moduleContent, 'utf8');
    console.log(`Module written to ${outputPath}`);
});