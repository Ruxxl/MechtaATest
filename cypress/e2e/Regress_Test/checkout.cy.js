import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";

const Checkout = new checkout();
const Add_basket = new add_basket();

describe('Оформление заказа', () => {

    beforeEach(() => {

        cy.session('base-home', () => {

            cy.visit('/');
            cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')
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
            .click()

        cy.intercept('GET', '**/api/v3/product/*').as('getProduct');

        cy.get('div.rounded-lg.rounded-mi-l > div.p-4.sm\\:p-6:nth-of-type(2) > div.w-full.h-full > div.relative.flex > a.w-full.justify-center:nth-of-type(2)', {
                timeout: 20000
            }).eq(0)
            .click()

        Add_basket.getProduct()

        Add_basket.intercept_request()

        cy.get('body').then(($body) => {
            // Проверяем наличие текста "В корзине" через jQuery (не падает, если не найдено)
            if ($body.text().includes('В корзине')) {
                cy.log('Товар уже в корзине');
                cy.contains('span', 'В корзине').should('be.visible');
            } else {
                cy.log('Товара нет, добавляем...');
                cy.contains('span', 'В корзину', {
                        timeout: 10000
                    })
                    .should('be.visible')
                    .click();

                // Проверяем, что после клика текст сменился на "В корзине"
                cy.contains('span', 'В корзине', {
                    timeout: 10000
                }).should('be.visible');
            }
        });

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

        cy.login()

        cy.visit('/')

        Checkout.request_intercept()

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

    it('Первый шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас', {
                timeout: 20000
            }).first()
            .click()

        Checkout.step_one()

    })

    it('Второй шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас', {
                timeout: 20000
            }).first()
            .click()

        Checkout.step_one()

        Checkout.step_two()
    })

    it('Третий шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.step_one()

        Checkout.step_two()

        Checkout.step_three()

    })

    it('Оформление заказа "Картой"', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        cy.visit('/checkout')

        Checkout.checkout_card()

    })

    it('Оформление заказа "Рассрочка/Кредит"', () => {

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-17-pro-max-256gb-deep-blue/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.checkout_broker()

    })

})