describe('Главная страница', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Проверка отображения раздела "Акции и Новости"', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('getProduct');

        cy.visit('https://www.mechta.kz/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/').wait(5000)

        cy.wait('@getProduct').then((interception) => {
            const productId = interception.response.body.name;
            cy.log('Product ID:', productId);
        })

        



        
    })
})