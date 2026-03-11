import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";

const Checkout = new checkout();
const Add_basket = new add_basket();

describe('Оформление заказа', () => {

    beforeEach(() => {

        cy.session('base-home', () => {

            cy.visit('/');
        });
    });

    it('Открывает базовый URL', () => {

        cy.visit('/')

        cy.url().should('include', 'pp.yc.mechta.kz')
    })

    it('Перейти в оформление заказа', () => {

        cy.visit('/checkout/')

        cy.url().should('include', 'checkout')
    })

    it('Авторизация перед оформлением заказа', () => {

        cy.visit('/')

        Checkout.auth_checkout()

    })

    it('Добавление товара в корзину', () => {

        cy.visit('/')

        cy.contains('a', 'Смартфоны Apple', {
                timeout: 20000
            }).first()
            .click()

        cy.intercept('GET', '**/api/v3/product/*').as('getProduct');

        cy.get('div.rounded-lg.rounded-mi-l > div.p-4.sm\\:p-6:nth-of-type(2) > div.w-full.h-full > div.relative.flex > a.w-full.justify-center:nth-of-type(2)', {
                timeout: 20000
            }).eq(0)
            .click()

        Add_basket.getProduct()

        Add_basket.intercept_request()

        cy.contains('button', 'В корзину', {
                timeout: 20000
            }).first()
            .click()

        Add_basket.check_intercept()

        cy.contains('span', 'В корзине', {
                timeout: 20000
            }).first()
            .should('be.visible')

        cy.contains('li', 'Товар добавлен в корзину', {
                timeout: 20000
            }).first()
            .should('be.visible')
    })

    it('Переход в оформление с корзины', () => {

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

        cy.contains('button', 'В корзину', {
                timeout: 20000
            }).first()
            .click()

        Add_basket.check_intercept()

        cy.contains('span', 'В корзине', {
                timeout: 20000
            }).first()
            .should('be.visible')

        cy.contains('li', 'Товар добавлен в корзину', {
                timeout: 20000
            }).first()
            .should('be.visible')

        cy.visit('/basket')

        cy.url({
            timeout: 20000
        }).should('include', 'basket')

        cy.contains('span', 'Оформить заказ', {
                timeout: 20000
            })
            .first()
            .should('be.visible')
            .click()

        cy.url({
            timeout: 20000
        }).should('include', '/checkout')

    })

    it('Переход в оформление с кнопки "Купить сейчас"', () => {

        cy.visit('/')

        Checkout.auth_checkout()

        cy.contains('a', 'Смартфоны Apple', {
                timeout: 20000
            }).first()
            .click({
                timeout: 20000
            })

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

    })
})