import { writeFile } from 'node:fs/promises';
import { serializeSchema } from '../core';
await writeFile('schema.json', serializeSchema());
console.log('Generated schema.json');
