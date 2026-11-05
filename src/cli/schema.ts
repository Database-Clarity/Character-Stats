import { writeFile } from 'node:fs/promises';
import { generateDeclarations, serializeSchema } from '../core';
await writeFile('schema.json', serializeSchema());
await writeFile('character-stats.d.ts', generateDeclarations());
console.log('Generated schema.json and character-stats.d.ts');
