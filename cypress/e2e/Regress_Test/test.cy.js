import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";
import productPage from "../../integration/pageObjects/product_page";

const ProductPage = new productPage()

const Add_basket = new add_basket();

const Checkout = new checkout();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
            cy.login()
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {

        cy.login()

        // 1. Visit the page
        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/');

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

    })

})