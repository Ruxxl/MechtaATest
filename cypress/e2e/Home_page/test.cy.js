describe('Главная страница', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Проверка отображения раздела "Акции и Новости"', () => {
        cy.visit('/').wait(5000)

        cy.scrollTo('bottom', {duration: 500});
        cy.scrollTo('bottom', {duration: 500});
        cy.get('img[alt="preview\\ app\\ photo"]')
            .should('be.visible')
        cy.contains('button', 'Подписаться').first().should('be.visible')
    })
})