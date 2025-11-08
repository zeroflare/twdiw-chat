const fs = require('fs');
const path = require('path');

// Read the built index.html
const indexHtmlPath = path.join(__dirname, 'frontend/dist/index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Read the worker template
const workerTemplatePath = path.join(__dirname, 'src/index.template.ts');
const workerTemplate = fs.readFileSync(workerTemplatePath, 'utf8');

// Replace the placeholder with actual HTML
const workerCode = workerTemplate.replace('__INDEX_HTML_PLACEHOLDER__', indexHtml);

// Write the final worker file
const workerOutputPath = path.join(__dirname, 'src/index.ts');
fs.writeFileSync(workerOutputPath, workerCode);

console.log('Worker built with embedded index.html');
