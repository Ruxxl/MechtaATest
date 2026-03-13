import checkout from "../../integration/pageObjects/checkout";

const Checkout = new checkout();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smart-chasy-apple-watch-se-gps-40mm-midnight-aluminium-case-with-ink-sport-loop-mxea3qia/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.step_one()
        
        Checkout.step_two()

        Checkout.step_three()

    });

})
