describe('Главная страница', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Проверка отображения раздела "Акции и Новости"', () => {
        
    cy.visit('/');
    cy.scrollTo('bottom', { duration: 2000 });  
    cy.contains('h2', 'Смартфоны').first()
        .should('be.visible')
        .click()

    })
})