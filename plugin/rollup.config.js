import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: 'dist/esm/index.js',
    external: ['@capacitor/core', '@xenova/transformers'],
    output: {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      inlineDynamicImports: true,
      globals: {
        '@capacitor/core': 'capacitorExports',
        '@xenova/transformers': 'transformers'
      }
    },
    plugins: [
      resolve({
        preferBuiltins: false,
        browser: true
      }),
      commonjs()
    ]
  },
  {
    input: 'dist/esm/index.js',
    external: ['@capacitor/core', '@xenova/transformers'],
    output: {
      file: 'dist/plugin.js',
      format: 'esm',
      name: 'Small100OnnxTranslator',
      inlineDynamicImports: true,
      globals: {
        '@capacitor/core': 'capacitorExports',
        '@xenova/transformers': 'transformers'
      }
    },
    plugins: [
      resolve({
        preferBuiltins: false,
        browser: true
      }),
      commonjs()
    ]
  }
];
