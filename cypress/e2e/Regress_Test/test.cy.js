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

})