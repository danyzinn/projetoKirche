import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';
// Rotas de gestão usam lazy import, inclusive em ambientes de CI concorridos.
configure({ asyncUtilTimeout: 5000 });
