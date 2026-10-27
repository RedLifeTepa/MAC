import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await rm(root+'site',{recursive:true,force:true});
await mkdir(root+'site',{recursive:true});
await cp(root+'web',root+'site',{recursive:true});
await writeFile(root+'site/.nojekyll','');
console.log('GitHub Pages: publica únicamente site/.');
