// Complete demo-mode run: boards, columns, cards, categories, banner layout.
// Simulates an insecure context (plain http on a non-localhost host) where
// crypto.randomUUID is undefined, the cause of "crypto.randomUUID is not a function".

describe('demo mode full run', () => {
  beforeEach(() => {
    cy.intercept('**/rest/v1/**', cy.spy().as('rest'));
    cy.intercept('**/auth/v1/**', cy.spy().as('auth'));
  });

  afterEach(() => {
    cy.get('@rest').should('not.have.been.called');
    cy.get('@auth').should('not.have.been.called');
  });

  const visit = (path: string) =>
    cy.visit(path, {
      onBeforeLoad(win) {
        Object.defineProperty(win.crypto, 'randomUUID', { value: undefined, configurable: true });
      },
    });

  it('keeps the banner inside the main view, not above the navigation', () => {
    visit('/boards');
    cy.contains('Demo mode').should('be.visible');
    cy.get('aside').first().then(($aside) => {
      expect($aside[0].getBoundingClientRect().top).to.eq(0);
    });
    cy.contains('Demo mode').closest('div').then(($banner) => {
      const aside = Cypress.$('aside')[0].getBoundingClientRect();
      expect($banner[0].getBoundingClientRect().left).to.be.gte(aside.right);
    });
  });

  it('creates, edits and deletes categories', () => {
    visit('/categories');
    cy.contains('button', '+ New category').click();
    cy.get('input[name=categoryName]').type('Errands');
    cy.contains('button', 'Create category').click();
    cy.contains('Create category').should('not.exist');
    cy.contains('li', 'Errands').should('be.visible').click();

    cy.get('input[name=categoryName]').clear().type('Chores');
    cy.contains('button', 'Save').click();
    cy.contains('li', 'Chores').should('be.visible');
    cy.contains('Errands').should('not.exist');

    cy.contains('li', 'Chores').click();
    cy.contains('button', 'Delete category').click();
    cy.contains('.fixed button', 'Delete').click();
    cy.contains('Chores').should('not.exist');
  });

  it('creates a board with default columns, adds a card, then deletes the board', () => {
    visit('/boards');
    cy.contains('button', '+ New board').click();
    // Default columns must be present (previously empty -> "At least one column is required").
    cy.get('input[placeholder="Column name"]').should('have.length.at.least', 1);
    cy.get('input[name=boardName]').type('Full run board');
    cy.contains('button', 'Create board').click();
    cy.contains('At least one column is required').should('not.exist');
    cy.location('pathname').should('match', /^\/boards\/.+/);
    cy.contains('h1', 'Full run board').should('be.visible');

    cy.get('input[placeholder="Add card"]:visible').first().type('First card{enter}');
    cy.contains(':visible', 'First card').should('be.visible');

    cy.get('input[placeholder="+ Add column"]:visible').first().type('Extra{enter}');
    cy.get('input').should(($inputs) => {
      const values = $inputs.toArray().map((el) => (el as HTMLInputElement).value);
      expect(values).to.include('Extra');
    });

    cy.visit('/boards');
    cy.contains('Full run board').should('be.visible');
  });

  it('resets data to the seed board', () => {
    visit('/boards');
    cy.contains('button', '+ New board').click();
    cy.get('input[name=boardName]').type('Temp board');
    cy.contains('button', 'Create board').click();
    cy.location('pathname').should('match', /^\/boards\/.+/);
    cy.contains('button', 'Reset').click();
    cy.visit('/boards');
    cy.contains('Demo board').should('be.visible');
    cy.contains('Temp board').should('not.exist');
  });
});
