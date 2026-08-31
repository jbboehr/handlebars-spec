import eslint from '@eslint/js';
import { createNodeResolver, flatConfigs as importConfigs } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'handlebars.js/**',
            'patch/**',
            'spec/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    importConfigs.recommended,
    {
        files: ['src/**/*.ts'],
        settings: {
            'import-x/extensions': ['.js', '.mjs', '.ts'],
            'import-x/parsers': {
                '@typescript-eslint/parser': ['.ts'],
            },
            'import-x/resolver-next': [
                createNodeResolver({
                    extensions: ['.ts', '.d.ts', '.mjs', '.cjs', '.js', '.json', '.node'],
                    conditionNames: ['types', 'import', 'require', 'node', 'default'],
                    mainFields: ['types', 'typings', 'module', 'main'],
                }),
            ],
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'import-x/extensions': [
                'error',
                'ignorePackages',
                {
                    js: 'never',
                    mjs: 'never',
                    jsx: 'never',
                    ts: 'never',
                    tsx: 'never',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'no-prototype-builtins': 'off',
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            'import-x/named': 'off',
        },
    },
);
