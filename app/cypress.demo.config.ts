import { defineConfig } from 'cypress';

// Runs against a production build made with DEMO_MODE=true (see the demo-e2e CI job).
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/demo/**/*.cy.ts',
    // The board list is rendered by a shadow-DOM component.
    includeShadowDom: true,
  },
});
