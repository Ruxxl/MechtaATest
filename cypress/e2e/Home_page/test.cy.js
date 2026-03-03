describe('Главная страница', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Проверка отображения раздела "Акции и Новости"', () => {
        
    cy.visit('/');

    })
})