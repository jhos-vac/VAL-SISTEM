// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Límites entre dominios: cada base de datos tiene un solo módulo dueño.
// Los demás usan su API pública (servicios exportados), nunca el cliente
// Prisma de otra base. Ver docs/REVISION_ACID_MODULOS.md (C1, C2).
const DB_OWNERS = {
  user: [
    'src/auth/**',
    'src/users/**',
    'src/devices/**',
    'src/common/interceptors/audit-log.interceptor.ts',
  ],
  market: ['src/market/**'],
  portfolio: ['src/portfolio/**', 'src/jobs/job-lease.service.ts'],
};

const forbidDbs = (dbs) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: dbs.map((db) => ({
        group: [`**/${db}-prisma.service`, `**/generated/${db}-cli/**`],
        message: `Solo el módulo dueño de la base "${db}" puede usar su cliente Prisma. Usá su API pública.`,
      })),
    },
  ],
});

// Un bloque por área con TODAS las bases que no puede tocar: en flat config
// la última definición de una regla reemplaza a las anteriores, no se suman.
function dbBoundaries() {
  const dbs = Object.keys(DB_OWNERS);
  const allOwners = Object.values(DB_OWNERS).flat();
  return [
    ...dbs.map((db) => ({
      files: DB_OWNERS[db],
      rules: forbidDbs(dbs.filter((other) => other !== db)),
    })),
    {
      files: ['src/**/*.ts'],
      ignores: [...allOwners, 'src/prisma/**'],
      rules: forbidDbs(dbs),
    },
  ];
}

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...dbBoundaries(),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
