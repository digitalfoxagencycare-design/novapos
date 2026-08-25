import React from 'react';
import { createRoot } from 'react-dom/client';
import { Kds } from './Kds';
import './styles/app.css';
import './styles/kds.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Kds />
  </React.StrictMode>,
);
