import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";

const Add_basket = new add_basket();

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

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.checkout_broker()

    })

})