#!/usr/bin/env node
import path from 'node:path';
import main from './index';

async function start() {
  const config = await import(path.join(process.cwd(), 'api.config.ts'))
  main(config.default.apiDocs)
}

start()
