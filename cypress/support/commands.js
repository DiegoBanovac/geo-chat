Cypress.Commands.add('login', (email, lozinka) => {
  cy.visit('http://localhost:5173/');
  cy.get('input[type="email"]').clear().type(email);
  cy.get('input[placeholder="Unesite lozinku"]').clear().type(lozinka);
  cy.contains('button', 'Prijavi se').click();
  cy.contains('GeoChat', { timeout: 8000 }).should('be.visible');
});

Cypress.Commands.add('registrirajKorisnika', ({ ime, prezime, email, lozinka, datum }) => {
  cy.visit('http://localhost:5173/');
  cy.contains('button', 'Registracija').click();
  cy.get('input[placeholder="Vaše ime"]').type(ime);
  cy.get('input[placeholder="Vaše prezime"]').type(prezime);
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="date"]').type(datum);
  cy.get('input[placeholder="Najmanje 6 znakova"]').type(lozinka);
  cy.get('input[placeholder="Ponovite lozinku"]').type(lozinka);
  cy.contains('button', 'Registriraj se').click();
  cy.contains('Registracija je uspješna', { timeout: 6000 }).should('be.visible');
});

Cypress.Commands.add('odjava', () => {
  cy.contains('button', 'Odjava').click();
  cy.get('input[type="email"]').should('be.visible');
});

Cypress.Commands.add('otvoriNoviRazgovorModal', () => {
  cy.get('[data-cy="novi-chat-btn"]').click();
  cy.contains('button', 'Novi razgovor').click();
});

Cypress.Commands.add('otvoriNovaGrupaModal', () => {
  cy.get('[data-cy="novi-chat-btn"]').click();
  cy.contains('button', 'Nova grupa').click();
});

Cypress.Commands.add('otvoriChat', (naziv) => {
  cy.get('aside').contains(naziv).click();
});