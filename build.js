const fs = require('fs');
const https = require('https');

const MINIFIERS = {
    HTML: 'html-minifier',
    JS: 'javascript-minifier',
    CSS: 'cssminifier',
};

function minify(code, minifier) {
    const codeToMinify = 'input=' + encodeURIComponent(code);

    const minifyRequestOptions = {
        hostname: 'www.toptal.com',
        port: 443,
        path: '/developers/' + minifier + '/api/raw',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': codeToMinify.length,
        },
    };

    return new Promise((resolve, reject) => {
        const request = https.request(minifyRequestOptions, (res) => {
            let data = '';
        
            res.on('data', (chunk) => {
                data += chunk;
            });
        
            res.on('end', () => resolve(data));
        
        }).on('error', reject);
        
        request.write(codeToMinify);
        request.end();
    });
}

(async () => {
    fs.rmSync('./dist', { recursive: true, force: true });
    fs.rmSync('./dist-min', { recursive: true, force: true });

    let indexHTML = fs.readFileSync('./index.html', 'utf8');

    let styleCSS = fs.readFileSync('./style.css', 'utf8');

    let indexJS = fs.readFileSync('./index.js', 'utf8')
        .replace("import JSGLib from './jsglib.light.js';", '')
        .replace("import './character.js';", '')
        .replace("const TILE_SIZE = 16;", '');

    let characterJS = fs.readFileSync('./character.js', 'utf8')
        .replace("import JSGLib from './jsglib.light.js';", '');

    const jsglib = fs.readFileSync('./jsglib.light.js', 'utf8').replace('export default','var JSGLib=') + ';';

    const minifiedJS = await minify(jsglib + characterJS + indexJS, MINIFIERS.JS);
    const minifiedCSS = await minify(styleCSS, MINIFIERS.CSS);

    indexHTML = indexHTML
        .replace('<script type="module" src="index.js"></script>', `<script>${minifiedJS}</script>`)
        .replace('<link rel="stylesheet" href="./style.css" />', `<style>${minifiedCSS}</style>`)
        .replace('./images/favicon.png', './f.png')
        .replaceAll('./images/tiles.png', './t.png')
        .replaceAll('item-description', 'i-d')
        .replaceAll('data-prev-classname', 'data-pc')
        .replaceAll('dataset.prevClassname', 'dataset.pc')
        .replaceAll('upgradable', 'u')
        .replaceAll('bat-unlocked', 'bu')
        .replaceAll('ghost-unlocked', 'gu')
        .replaceAll('tuto-button', 'tb')
        .replaceAll('tutoCounter', 'tc')
        .replaceAll('tombstone', 'tt')
        .replaceAll('tile', 'z')
        .replaceAll('tuto-step', 'ts')
        .replaceAll('success', 's')
        .replaceAll('failure', 'f')
        .replaceAll('JSGLib', '$');

    const ids = [...indexHTML.matchAll(/id="([^"]*?)"/g)];

    ids.forEach((id, i) => {
        indexHTML = indexHTML.replaceAll(id[1], '_' + i);
    });

    const minifiedHTML = await minify(indexHTML, MINIFIERS.HTML);

    fs.mkdirSync('./dist');
    fs.cpSync('./images/favicon.png', './dist/f.png');
    fs.cpSync('./images/tiles.png', './dist/t.png');
    fs.writeFileSync( './dist/index.html', minifiedHTML, { encoding: 'utf8' });

    fs.mkdirSync('./dist-min');
    fs.cpSync('./images/favicon.png', './dist-min/f.png');
    fs.cpSync('./images/tiles.png', './dist-min/t.png');
    fs.writeFileSync( './dist-min/index.html', '<script>PACKED_CODE_HERE</script>', { encoding: 'utf8' });

    console.log('Done');
})();
