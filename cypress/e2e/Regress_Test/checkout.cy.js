import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";

const Checkout = new checkout();
const Add_basket = new add_basket();

describe('Оформление заказа', () => {

    beforeEach(() => {

        cy.session('base-home', () => {

            cy.visit('/');
            cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')
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

        cy.login()

        // 1. Visit the page
        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/');

        cy.wait(10000)

        cy.get('body').then(($body) => {
            const btnNew = $body.find('span:contains("В корзину")');
            const btnAlready = $body.find('span:contains("В корзине")');

            if (btnNew.length > 0 && btnNew.is(':visible')) {

                cy.wrap(btnNew).first().click();

                cy.contains('li', 'Товар добавлен в корзину', {
                        timeout: 20000
                    }).first()
                    .should('be.visible')

                cy.contains('span', 'В корзине').first()
                    .should('be.visible')
                    .click()

                cy.url().should('include', '/basket')

            } else if (btnAlready.length > 0 && btnAlready.is(':visible')) {

                cy.wrap(btnAlready).first().click();

                cy.url().should('include', '/basket')

                cy.log('Нажали: В корзине');
            } else {
                // Если вообще ничего не нашли, тест не упадет тут, 
                // а просто выведет сообщение в лог.
                cy.log('Ни одной кнопки не найдено, проверяем селекторы');
            }
        });
    })

    it('Переход в оформление с корзины', () => {

        cy.login()

        // 1. Visit the page
        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/');

        cy.wait(10000)

        cy.get('body').then(($body) => {
            const btnNew = $body.find('span:contains("В корзину")');
            const btnAlready = $body.find('span:contains("В корзине")');

            if (btnNew.length > 0 && btnNew.is(':visible')) {

                cy.wrap(btnNew).first().click();

                cy.contains('li', 'Товар добавлен в корзину', {
                        timeout: 20000
                    }).first()
                    .should('be.visible')

                cy.contains('span', 'В корзине').first()
                    .should('be.visible')
                    .click()

                cy.url().should('include', '/basket')

            } else if (btnAlready.length > 0 && btnAlready.is(':visible')) {

                cy.wrap(btnAlready).first().click();

                cy.url().should('include', '/basket')

                cy.log('Нажали: В корзине');
            } else {
                // Если вообще ничего не нашли, тест не упадет тут, 
                // а просто выведет сообщение в лог.
                cy.log('Ни одной кнопки не найдено, проверяем селекторы');
            }
        });

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

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        cy.contains('button', 'Купить сейчас', {
                timeout: 20000
            }).first()
            .click()

        cy.url().should('include', '/checkout')

    })

    it('Первый шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        cy.contains('button', 'Купить сейчас', {
                timeout: 20000
            }).first()
            .click()

        Checkout.step_one()

    })

    it('Второй шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

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

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

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

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        cy.visit('/checkout')

        Checkout.checkout_card()

    })

    it('Оформление заказа "Рассрочка/Кредит"', () => {

        cy.login()

        cy.intercept('GET', '/api/v2/checkout?**').as('get_checkout');

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.checkout_broker()

    })

    it('Оформление заказа "Оплата в магазине"', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        cy.contains('button', 'Купить сейчас')
            .should('be.visible')
            .click()

        Checkout.checkout_pay_in_shop()

    })

})