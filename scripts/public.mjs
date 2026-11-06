// Compatibility alias: customer and staff routes now use the same application.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), verb = process.argv[2] || 'dev';
if (!['dev', 'build', 'start'].includes(verb)) throw new Error('Choose dev, build or start.');
console.log('The loyalty page is part of the main portal at /loyalty. Port 3001 is no longer used.');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), verb, ...(verb === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', '3000'])], { stdio: 'inherit' });
child.on('exit', code => process.exit(code || 0));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
