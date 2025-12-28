import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Configure ONNX Runtime before initializing React
if (typeof window !== 'undefined') {
  // @ts-ignore
  if (typeof ort !== 'undefined') {
    // @ts-ignore
    ort.env.wasm.wasmPaths = 'https://unpkg.com/onnxruntime-web@1.18.0/dist/';
    // @ts-ignore
    ort.env.wasm.numThreads = 1;
    // @ts-ignore
    ort.env.wasm.simdSupported = false;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
