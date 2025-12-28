import { registerPlugin } from '@capacitor/core';
import type { Small100OnnxTranslatorPlugin } from './definitions';

const Small100OnnxTranslator = registerPlugin<Small100OnnxTranslatorPlugin>(
  'Small100OnnxTranslator',
  {
    web: () => import('./web').then(m => new m.Small100OnnxTranslatorWeb()),
  }
);

export * from './definitions';
export { Small100OnnxTranslator };
