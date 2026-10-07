// Scaffolds an empty hand-written migration (schema is never generated from entities).
// Usage: npm run migration:generate -- <kebab-name>
import { existsSync, writeFileSync } from 'node:fs';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('usage: npm run migration:generate -- <kebab-case-name>');
  process.exit(1);
}
const timestamp = Date.now();
const className = name.replace(/(^|-)([a-z0-9])/g, (_m, _d, c) => c.toUpperCase()) + timestamp;
const file = `src/database/migrations/${timestamp}-${name}.ts`;
if (existsSync(file)) throw new Error(`${file} exists`);
writeFileSync(
  file,
  `import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }
}
`,
);
console.log(`created ${file} - register ${className} in src/database/migrations/index.ts`);
