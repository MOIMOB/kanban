// Golden path: sign in, create a board, add a card, share the board.
// Supabase calls are stubbed with cy.intercept; no real project needed.

const USER = { id: 'user-1', email: 'anton@example.com' };
const BOARD = { id: 'board-1', name: 'Groceries', owner_id: USER.id, created_at: '2026-01-01T00:00:00Z' };
const COLUMNS = [
  { id: 'col-todo', board_id: BOARD.id, name: 'To Do', position: 0 },
  { id: 'col-doing', board_id: BOARD.id, name: 'Doing', position: 1 },
  { id: 'col-done', board_id: BOARD.id, name: 'Done', position: 2 },
];

// supabase-js decodes the access_token client-side, so it must be a valid JWT shape.
function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fake-signature`;
}

function authSession() {
  const user = { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated' };
  return {
    access_token: fakeJwt({ sub: USER.id, email: USER.email, role: 'authenticated' }),
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
}

describe('golden path', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/auth/v1/token*', { statusCode: 200, body: authSession() }).as('signIn');
    // Services call supabase.auth.getUser() before inserts.
    cy.intercept('GET', '**/auth/v1/user*', { statusCode: 200, body: authSession().user }).as(
      'getUser',
    );
    cy.intercept('GET', '**/rest/v1/kanban_boards*', { statusCode: 200, body: [] }).as('getOwnedBoards');
    cy.intercept('GET', '**/rest/v1/kanban_board_members?select=role*', {
      statusCode: 200,
      body: [],
    }).as('getSharedBoards');
  });

  it('signs in, creates a board, adds a card, and shares the board', () => {
    cy.visit('/login');
    cy.get('input[name=email]').type(USER.email);
    cy.get('input[name=password]').type('correct horse battery staple');
    cy.contains('button', 'Sign in').click();
    cy.wait('@signIn');
    cy.url().should('include', '/boards');

    // Create a board. The id is client-generated, so read it from the request body.
    let createdBoardId = '';
    cy.intercept('POST', '**/rest/v1/kanban_boards*', (req) => {
      createdBoardId = req.body.id;
      req.reply({ statusCode: 201 });
    }).as('createBoard');
    cy.intercept('POST', '**/rest/v1/kanban_columns*', { statusCode: 201 }).as('createColumns');
    cy.intercept('GET', '**/rest/v1/kanban_boards*', (req) => {
      req.reply({
        statusCode: 200,
        body: createdBoardId
          ? [{ ...BOARD, id: createdBoardId }]
          : [],
      });
    });
    cy.contains('button', '+ New board').click();
    cy.get('input[name=boardName]').type(BOARD.name);
    cy.contains('button', 'Create board').click();
    cy.wait(['@createBoard', '@createColumns']);
    cy.location('pathname').should((path) => {
      expect(path).to.eq(`/boards/${createdBoardId}`);
    });

    // Board detail loads its columns and (empty) cards.
    cy.intercept('GET', '**/rest/v1/kanban_columns*', { statusCode: 200, body: COLUMNS }).as('getColumns');
    cy.intercept('GET', '**/rest/v1/kanban_cards*', { statusCode: 200, body: [] }).as('getCards');
    cy.wait(['@getColumns', '@getCards']);
    cy.contains('h1', BOARD.name).should('be.visible');
    // Column names live in an editable <input>, so check .value rather than text content.
    cy.get('input').should(($inputs) => {
      const values = $inputs.toArray().map((el) => (el as HTMLInputElement).value);
      expect(values).to.include('To Do');
    });

    // Add a card to "To Do".
    const card = { id: 'card-1', column_id: 'col-todo', title: 'Buy milk', position: 0 };
    cy.intercept('POST', '**/rest/v1/kanban_cards*', { statusCode: 201, body: card }).as('createCard');
    // Mobile view renders a hidden copy of each column; pick the visible input.
    cy.get('input[placeholder="Add card"]:visible').first().type('Buy milk{enter}');
    cy.wait('@createCard');
    cy.contains(':visible', 'Buy milk').should('be.visible');

    // Share the board with a collaborator.
    cy.intercept('GET', '**/rest/v1/kanban_board_members*', { statusCode: 200, body: [] }).as('getMembers');
    cy.contains('button', 'Share').click();
    cy.wait('@getMembers');

    cy.intercept('POST', '**/rest/v1/rpc/find_user_id_by_email*', {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('user-2'),
    }).as('lookupEmail');
    cy.intercept('POST', '**/rest/v1/kanban_board_members*', { statusCode: 201, body: {} }).as('addMember');
    cy.intercept('GET', '**/rest/v1/kanban_board_members*', {
      statusCode: 200,
      body: [{ board_id: BOARD.id, user_id: 'user-2', role: 'editor', kanban_profiles: { email: 'friend@example.com' } }],
    }).as('getMembersAfterAdd');

    cy.get('input[name=email]').type('friend@example.com');
    cy.contains('button', 'Add').click();
    cy.wait(['@lookupEmail', '@addMember']);
    cy.contains('friend@example.com').should('be.visible');
  });
});
