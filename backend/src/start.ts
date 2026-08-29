import { spawn } from 'child_process';

const server = spawn('node', ['dist/server.js'], {
    stdio: 'inherit',
});

const worker = spawn('node', ['dist/workers/email.worker.js'], {
    stdio: 'inherit',
});

server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    worker.kill();
    process.exit(code ?? 0);
});

worker.on('exit', (code) => {
    console.log(`Worker exited with code ${code}`);
});