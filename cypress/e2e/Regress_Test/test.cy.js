import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";
import productPage from "../../integration/pageObjects/product_page";

const ProductPage = new productPage()

const Add_basket = new add_basket();

const Checkout = new checkout();

const product_page = '/product/smartfon-apple-iphone-17-pro-max-256gb-cosmic-orange/'

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
            cy.login()
        });
    });

    it('Тестовый сценарии', () => {

        cy.visit(product_page);

    })

})