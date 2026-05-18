describe('Acceptance Test: GeoChat Autentifikacija', () => {
  
  const frontendUrl = 'http://localhost:5173/'; 
  
  const rand = Math.floor(Math.random() * 100000);
  const noviKorisnik = {
    ime: 'Marko',
    prezime: 'Marković',
    email: `marko.${rand}@test.com`,
    lozinka: 'Sifra123!',
    datum: '1995-10-10'
  };

  it('Korisnik se uspešno registruje i nakon toga prijavljuje u aplikaciju', () => {
    
    cy.visit(frontendUrl);

    
    cy.contains('button', 'Registracija').click();

    
    cy.get('input[placeholder="Vaše ime"]').type(noviKorisnik.ime);
    cy.get('input[placeholder="Vaše prezime"]').type(noviKorisnik.prezime);
    
   
    cy.get('input[type="email"]').type(noviKorisnik.email);
    
   
    cy.get('input[type="date"]').type(noviKorisnik.datum);
    
    
    cy.get('input[placeholder="Najmanje 6 znakova"]').type(noviKorisnik.lozinka);
    cy.get('input[placeholder="Ponovite lozinku"]').type(noviKorisnik.lozinka);

   
    cy.contains('button', 'Registriraj se').click();

    
    cy.contains('Registracija je uspješna! Možete se prijaviti.').should('be.visible');
    
   
    cy.contains('button', 'Prijava').should('have.class', 'bg-teal-500');

    
    cy.get('input[type="email"]').clear().type(noviKorisnik.email);
    cy.get('input[placeholder="Unesite lozinku"]').type(noviKorisnik.lozinka);

    
    cy.contains('button', 'Prijavi se').click();

   
    cy.contains('GeoChat').should('be.visible');
  });
});