import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.small100onnx.demochat',
  appName: 'Translation Chat',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Small100OnnxTranslator: {},
  },
};

export default config;
