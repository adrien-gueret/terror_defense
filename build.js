const fs = require('fs');

fs.rmSync('./dist', { recursive: true, force: true });
fs.rmSync('./dist-min', { recursive: true, force: true });

let indexHTML = fs.readFileSync('./index.html', 'utf8');

let indexJS = fs.readFileSync('./index.js', 'utf8')
    .replace("import JSGLib from './jsglib.min.js';", '')
    .replace("import './character.js';", '')
    .replace("const TILE_SIZE = 16;", '');

let characterJS = fs.readFileSync('./character.js', 'utf8')
    .replace("import JSGLib from './jsglib.min.js';", '');

const jsglib = fs.readFileSync('./jsglib.min.js', 'utf8').replace('export default','var JSGLib=') + ';';

const jsContent = jsglib + characterJS + indexJS;

indexHTML = indexHTML
    .replace('<script type="module" src="index.js"></script>', `<script>${jsContent}</script>`)
    .replace('./images/favicon.png', './f.png')
    .replaceAll('./images/tiles.png', './t.png');

const ids = [...indexHTML.matchAll(/id="([^"]*?)"/g)];

ids.forEach((id, i) => {
    indexHTML = indexHTML.replaceAll(id[1], '_' + i);
});

fs.mkdirSync('./dist');
fs.cpSync('./images/favicon.png', './dist/f.png');
fs.cpSync('./images/tiles.png', './dist/t.png');
fs.writeFileSync( './dist/index.html', indexHTML, { encoding: 'utf8' });

fs.mkdirSync('./dist-min');
fs.cpSync('./images/favicon.png', './dist-min/f.png');
fs.cpSync('./images/tiles.png', './dist-min/t.png');
fs.writeFileSync( './dist-min/index.html', '<script>MINIFIED_CODE_HERE</script>', { encoding: 'utf8' });

console.log('Done');