// Log imediato
console.log('✅ main.tsx carregado');
console.error('✅ main.tsx carregado (error)');
alert('Main.tsx carregado!');

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('✅ Imports carregados');

// Inicializar React
const rootElement = document.getElementById("root");

if (rootElement) {
  console.log('✅ Root encontrado, criando React root...');
  const root = createRoot(rootElement);
  
  console.log('✅ Renderizando App...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('✅ React renderizado com sucesso!');
  alert('React renderizado!');
} else {
  console.error('❌ Elemento root não encontrado!');
  alert('Erro: root não encontrado');
}

