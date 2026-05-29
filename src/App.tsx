/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useEffect} from 'react';
import {initApp} from './logic.ts';

export default function App() {
  useEffect(() => {
    // Inicializa a lógica após o DOM padrão ser carregado pelo React
    initApp();
  }, []);
  
  return null; // O conteúdo real está no index.html
}
