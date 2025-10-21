import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['node_modules', 'dist', 'docs'] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      "no-empty-function": "off", // Note: you must disable the base rule as it can report incorrect errors
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { "ignoreVoidOperator": true, "ignoreArrowShorthand": true }],
      "@typescript-eslint/no-empty-function": ["error", { "allow": ["arrowFunctions", "private-constructors", "protected-constructors"] }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "all", "argsIgnorePattern": "^_", "caughtErrors": "all", "caughtErrorsIgnorePattern": "^_", "destructuredArrayIgnorePattern": "^_", "varsIgnorePattern": "^_", "ignoreRestSiblings": true } ],
      "@typescript-eslint/explicit-function-return-type": ["error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowIIFEs: true,
        },
      ],
      "no-restricted-syntax": [
        "error",

        // 1) Disallow mutable shorthand params: `x: T[]`
        {
          "selector": [
            "FunctionDeclaration > Identifier[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "FunctionExpression  > Identifier[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "ArrowFunctionExpression > Identifier[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "TSMethodSignature > Identifier[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "TSFunctionType > Identifier[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "RestElement[typeAnnotation.typeAnnotation.type='TSArrayType']",
            "ArrayPattern[typeAnnotation.typeAnnotation.type='TSArrayType']"
          ].join(", "),
          "message": "Array parameters must be readonly (use `readonly T[]`)."
        },
  
        // 2) Disallow mutable generic params: `x: Array<T>`
        {
          "selector": [
            "FunctionDeclaration > Identifier[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "FunctionExpression  > Identifier[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "ArrowFunctionExpression > Identifier[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "TSMethodSignature > Identifier[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "TSFunctionType > Identifier[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "RestElement[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']",
            "ArrayPattern[typeAnnotation.typeAnnotation.type='TSTypeReference'][typeAnnotation.typeAnnotation.typeName.name='Array']"
          ].join(", "),
          "message": "Array parameters must be readonly (use `readonly T[]` or `ReadonlyArray<T>`)."
        }
      ],
    }
  },
)
