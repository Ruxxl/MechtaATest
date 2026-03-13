import checkout from "../../integration/pageObjects/checkout";

const Checkout = new checkout();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {


        cy.visit('/')

        Checkout.auth_checkout()
       

    });

})
