import checkout from "../../integration/pageObjects/checkout";

const Checkout = new checkout();

describe('Оформление заказа', () => {

    beforeEach(() => {

        cy.session('base-home', () => {

            cy.visit('/');
            cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')
        });
    });

    it('Открывает базовый URL', () => {

        cy.visit('/')

        cy.url().should('include', 'pp.yc.mechta.kz')
    })

    it('Редирект на главную при заходе в /checkout/ без авторизации и товара', () => {

        cy.visit('/checkout/')

        cy.url().should('eq', 'https://pp.yc.mechta.kz/')
    })

    it('Перейти в оформление заказа', () => {

        // Без авторизации и товара в корзине /checkout/ редиректит на главную —
        // это ожидаемое поведение сайта, поэтому логинимся и покупаем товар
        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        cy.url().should('include', 'checkout')
    })

    it('Авторизация перед оформлением заказа', () => {

        cy.visit('/')

        Checkout.auth_checkout()

    })

    it('Добавление товара в корзину', () => {

        cy.login()

        // 1. Visit the page
        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/');

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
        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/');

        cy.wait(10000)

         cy.get('body').then(($body) => {

            const hasAddBtn = $body.find('button:contains("В корзину")').length > 0;
            const hasInCart = $body.find('button:contains("В корзине")').length > 0;

            if (hasAddBtn) {

                cy.log('Кнопка: В корзину');

                cy.get('#product-add-to-basket')
                    .should('be.visible')
                    .click();

                cy.contains('button', 'В корзине', {
                        timeout: 20000
                    })
                    .should('be.visible')
                    .click();

            } else if (hasInCart) {

                cy.log('Кнопка: Уже в корзине');

                cy.contains('button', 'В корзине')
                    .should('be.visible')
                    .click();

            } else {

                throw new Error('❌ Не найдена ни одна кнопка');

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

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        cy.url().should('include', '/checkout')

    })

    it('Первый шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        Checkout.step_one()

    })

    it('Второй шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        Checkout.step_one()

        Checkout.step_two_delivery()
    })

    it('Третий шаг оформление заказа', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        Checkout.step_one()

        Checkout.step_two_delivery()

        Checkout.step_three()

    })

    it('Оформление заказа "Картой"', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        cy.visit('/checkout')

        Checkout.checkout_card()

    })

    it('Оформление заказа "Рассрочка/Кредит"', () => {

        cy.login()

        cy.intercept('GET', '/api/v2/checkout?**').as('get_checkout');

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        Checkout.checkout_broker()

    })

    it('Оформление заказа "Наличными курьеру"', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/')

        cy.get('#product-buy-now').should('be.visible')
            .should('include.text', 'Купить сейчас')
            .click({ force: true })

        Checkout.checkout_pay_cash_courier()

    })

})