#!/usr/bin/env node
import { spawn } from 'child_process';

const testServer = spawn('npx', ['playwright', 'test', '--ui'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

testServer.on('close', (code) => {
  console.log(`Test server exited with code ${code}`);
  process.exit(code);
});
