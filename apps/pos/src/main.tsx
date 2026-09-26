import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';
import { installViewportGuards } from './lib/viewport';

const disposeViewport = installViewportGuards();
if (import.meta.hot) import.meta.hot.dispose(disposeViewport);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
