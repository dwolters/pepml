const fs = require('fs');
const path = require('path');
const peggy = require('peggy');

function convertFilesInFolder(folderPath, fileExtension, conversionFunction, newExtension) {
  processFilesInFolder(folderPath,fileExtension,(data, file) => {
    // Execute the conversion function
    const convertedData = conversionFunction(data);

    // Generate the new file name with different extension
    const newFileName = file.replace(`.${fileExtension}`, `.${newExtension}`);
    const newFilePath = path.join(folderPath, newFileName);

    fs.writeFileSync(newFilePath, convertedData, 'utf8');
    console.log(`File converted and saved: ${newFilePath}`);
  })
}

function processFilesInFolder(folderPath, fileExtension, processFunction) {
  try {
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const fileExt = path.extname(file);

      if (fileExt === `.${fileExtension}`) {
        const data = fs.readFileSync(filePath, 'utf8');

        // Execute the conversion function
        processFunction(data, file);
      }
    });
  } catch (err) {
    console.error('Error reading folder:', err);
  }
}

function copyFilesByExtension(sourceFolder, targetFolder, extension) {
  // Create the target folder if it doesn't exist
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
    console.log('Creating target folder: ', targetFolder);
  }

  // Read the source folder
  fs.readdirSync(sourceFolder).forEach((file) => {
    const sourceFilePath = path.join(sourceFolder, file);
    const targetFilePath = path.join(targetFolder, file);

    // Check if the file has the desired extension
    if (path.extname(file) === `.${extension}`) {
      // Copy the file to the target folder
      fs.copyFileSync(sourceFilePath, targetFilePath);
      console.log(`Copied: ${sourceFilePath} --> ${targetFilePath}`);
    }
  });
}

function hjsToModule(hjsTemplate) { return "import Handlebars from 'handlebars';\nexport default Handlebars.compile(`" + hjsTemplate + '`);' }
function generateParser(grammar) {return peggy.generate(grammar, {output:'source',format:'es'})}

let tggModuleFile = 'src/modules/tggs.ts';
function addTGGIndex(data, file) {
  console.log(file);
  let tggModule = fs.readFileSync(tggModuleFile, 'utf8');
  tggModule = tggModule.replace(new RegExp(`\\s*//Begin:${file}[\\s\\S]*//End:${file}`,'mg'),'')
  tggModule = tggModule.replace('//TGG_PLACEHOLDER',`//Begin:${file}\n${data},\n//End:${file}\n//TGG_PLACEHOLDER`)
  fs.writeFileSync(tggModuleFile,tggModule);
}

function replaceFilenameReferences(data, file) {
  console.log(file);
  let tggModule = fs.readFileSync(tggModuleFile, 'utf8');
  tggModule = tggModule.replaceAll(`"${file}"`,'`' + data + '`')
  fs.writeFileSync(tggModuleFile,tggModule);
}

function addMetamodel(data, file) {
  console.log(file);
  let mmName = file.substring(0,file.indexOf('.'));
  let tggModule = fs.readFileSync(tggModuleFile, 'utf8');
  tggModule = tggModule.replace(new RegExp(`\\s*//Begin:${mmName}\\n[\\s\\S]*//End:${mmName}\\n`,'mg'),'')
  tggModule = tggModule.replace('//METAMODEL_PLACEHOLDER',`//Begin:${mmName}\n"${mmName}": \`${data}\`,\n//End:${mmName}\n//METAMODEL_PLACEHOLDER`)
  fs.writeFileSync(tggModuleFile,tggModule);
  let tggIndex = fs.readFileSync(tggModuleFile, 'utf8');
  tggModule = tggModule.replaceAll(`"${file}"`,'`' + data + '`')
  fs.writeFileSync(tggModuleFile,tggModule);
}

processFilesInFolder('tggs', 'json', addTGGIndex);
processFilesInFolder('tggs', 'msl', replaceFilenameReferences);
processFilesInFolder('tggs', 'gentgg', replaceFilenameReferences);
processFilesInFolder('tggs', 'tgg', replaceFilenameReferences);
convertFilesInFolder('src/templates', 'hjs', hjsToModule, 'js');
convertFilesInFolder('src/parsers', 'pegjs', generateParser, 'js');
copyFilesByExtension('src/parsers', 'lib/parsers', 'js');
copyFilesByExtension('src/templates', 'lib/templates', 'js');
