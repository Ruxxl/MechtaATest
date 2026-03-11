import actionPage from '../../integration/pageObjects/action';
import add_basket from '../../integration/pageObjects/add_basket';
import checkout from "../../integration/pageObjects/checkout";

const ActionPage = new actionPage();
const Add_basket = new add_basket();
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

        cy.contains('a', 'Смартфоны Apple', {
                timeout: 20000
            }).first()
            .click({timeout: 20000})

        cy.intercept('GET', '**/api/v3/product/*').as('getProduct');

        cy.get('div.rounded-lg.rounded-mi-l > div.p-4.sm\\:p-6:nth-of-type(2) > div.w-full.h-full > div.relative.flex > a.w-full.justify-center:nth-of-type(2)', {
                timeout: 20000
            }).eq(0)
            .click()

        Add_basket.getProduct()

        Add_basket.intercept_request()

        cy.contains('button', 'Купить сейчас', {
                timeout: 20000
            }).first()
            .click()

        cy.url().should('include', '/checkout')
    });
})