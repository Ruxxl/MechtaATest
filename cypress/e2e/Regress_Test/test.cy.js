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

        ProductPage.interceptRequests()

        cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

        ProductPage.check_main_properties()

    })

})