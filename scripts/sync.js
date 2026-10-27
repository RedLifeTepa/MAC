import {copyFile} from 'node:fs/promises';
await copyFile('web/src/domain.js','functions/domain.js');
console.log('Dominio de Functions sincronizado.');
