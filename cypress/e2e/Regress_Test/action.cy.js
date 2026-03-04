describe('Страница Акции', () => {

    beforeEach(() => {
        cy.session('base-home', () => {

            cy.visit('/');
        });
    });

    it('Перейти на страницу Акции через главное меню', () => {
        // Your test steps here
        cy.get('[data-testid="button"]').click();
        cy.contains('Success').should('be.visible');
    });

    it('Перейти на страницу Акции по прямой ссылке', () => {
        // Form interaction example
        cy.get('input[type="text"]').type('test input');
        cy.get('button[type="submit"]').click();
        cy.url().should('include', '/success');
    });

    afterEach(() => {
        // Cleanup after each test if needed
    });
});