import {spawn} from 'node:child_process';
const command=process.platform==='win32'?'firebase.cmd':'firebase';
const child=spawn(command,['emulators:exec','--project','demo-mac-store','--only','auth,firestore,storage','node tests/firebase.emulator.mjs'],{stdio:'inherit',env:{...process.env,MAC_TEST_UI:'1'}});
child.on('error',()=>{console.error('Instala Firebase CLI antes de esta prueba.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
