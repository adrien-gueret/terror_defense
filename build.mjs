import fs from 'fs';
import { execSync } from 'child_process';
import { minify } from 'minify';
import { Packer } from 'roadroller';
import { zip, COMPRESSION_LEVEL  } from 'zip-a-folder';

(async () => {
    console.log('Remove previous entry files...');
    fs.rmSync('./entry', { recursive: true, force: true });
    fs.rmSync('./entry.zip', { force: true });

    console.log('Get project files content...');

    let indexHTML = fs.readFileSync('./index.html', 'utf8');

    let styleCSS = fs.readFileSync('./style.css', 'utf8');

    let indexJS = fs.readFileSync('./index.js', 'utf8')
        .replace("import JSGLib from './jsglib.light.js';", '')
        .replace("import './character.js';", '')
        .replace("const TILE_SIZE = 16;", '');

    let characterJS = fs.readFileSync('./character.js', 'utf8')
        .replace("import JSGLib from './jsglib.light.js';", '');

    const jsglib = fs.readFileSync('./jsglib.light.js', 'utf8').replace('export default','var JSGLib=') + ';';

    console.log('Minify JS...');
    const minifiedJS = await minify.js(jsglib + characterJS + indexJS);
    
    console.log('Minify CSS...');
    const minifiedCSS = await minify.css(styleCSS);

    console.log('Minify HTML...');
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

    const minifiedHTML = await minify.html(indexHTML);

    console.log('Pack project...');
    const inputToPack = [{
        data: minifiedHTML,
        type: 'text',
        action: 'write',
    }];
    
    const packer = new Packer(inputToPack);
    await packer.optimize();
    
    const packedCode = packer.makeDecoder();

    console.log('Write entry files...');

    fs.mkdirSync('./entry');
    fs.cpSync('./images/favicon.png', './entry/f.png');
    fs.cpSync('./images/tiles.png', './entry/t.png');
    fs.writeFileSync( './entry/index.html', `<script>${packedCode.firstLine + packedCode.secondLine}</script>`, { encoding: 'utf8' });

    console.log('Zip entry folder...');
    await zip('./entry', './entry.zip', {compression: COMPRESSION_LEVEL.high});

    console.log('Compress zip...')
    try {
        await execSync('ect.exe -9 -zip ./entry.zip', { env: process.env });
    } catch(e) {
        console.warn('⚠ Cannot compress zip, please be sure ect.exe is installed and available from global scope');
    }

    console.log('Get entry size...');
    const { size } = fs.statSync('./entry.zip');

    console.log('Entry size: ' + size + ' bytes');

    const JS13K_LIMIT_SIZE = 13312;

    if (size > JS13K_LIMIT_SIZE) {
        console.error('❌ File is '+ (size - JS13K_LIMIT_SIZE) +'bytes too big!');
    } else {
        const percent = Math.round(((size * 100) / JS13K_LIMIT_SIZE) * 100) / 100;
        console.log('✅ All good! (' + percent + '% of total budget)');
    }

    console.log('');
    console.log('Entry generated');
})();