// Verifies the DEMO_MODE build-time env var (netlify.toml -> env.js) really switches the app
// into demo mode: no login, no Supabase traffic, data kept in localStorage.
// Expects a build made with the exact command from netlify.toml and DEMO_MODE=true.

describe('demo mode', () => {
  beforeEach(() => {
    // Any backend call means demo mode leaked to Supabase.
    cy.intercept('**/rest/v1/**', cy.spy().as('rest'));
    cy.intercept('**/auth/v1/**', cy.spy().as('auth'));
    cy.intercept('**/storage/v1/**', cy.spy().as('storage'));
  });

  afterEach(() => {
    for (const alias of ['@rest', '@auth', '@storage']) {
      cy.get(alias).should('not.have.been.called');
    }
  });

  it('skips login and shows the demo banner', () => {
    cy.visit('/login');
    cy.location('pathname').should('eq', '/boards');
    cy.contains('Demo mode').should('be.visible');
    cy.contains('Demo board').should('be.visible');
    cy.contains('button', 'Sign out').should('not.exist');
  });

  it('protected routes work without signing in', () => {
    cy.visit('/categories');
    cy.location('pathname').should('eq', '/categories');
    cy.contains('Demo mode').should('be.visible');
  });

  it('persists data in localStorage and can be reset', () => {
    cy.visit('/boards');
    cy.contains('button', '+ New board').click();
    cy.get('input[name=boardName]').type('Persisted board');
    cy.contains('button', 'Create board').click();
    cy.location('pathname').should('match', /^\/boards\/.+/);

    cy.reload();
    cy.visit('/boards');
    cy.contains('Persisted board').should('be.visible');
    cy.window().its('localStorage').invoke('getItem', 'kanban:demo-db').should('contain', 'Persisted board');

    // Cypress auto-accepts the confirm() dialog.
    cy.contains('button', 'Reset').click();
    cy.contains('Demo board').should('be.visible');
    cy.contains('Persisted board').should('not.exist');
  });
});

// Same build, but env.js swapped for a non-demo one: proves the flag alone is the switch.
describe('without DEMO_MODE', () => {
  it('requires login and shows no demo banner', () => {
    // The prod build registers a service worker that would serve the cached env.js
    // and bypass cy.intercept, so drop it first.
    cy.visit('/boards');
    cy.window().then(async (win) => {
      const regs = await win.navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    });
    cy.intercept({ pathname: '/env.js' }, {
      headers: { 'content-type': 'application/javascript' },
      body: "window.__env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', DEMO_MODE: '' };",
    });
    cy.intercept('**/auth/v1/**', { statusCode: 200, body: { data: { session: null } } });
    cy.visit('/boards');
    cy.window().its('__env.DEMO_MODE').should('eq', '');
    cy.location('pathname').should('eq', '/login');
    cy.contains('Demo mode').should('not.exist');
  });
});
