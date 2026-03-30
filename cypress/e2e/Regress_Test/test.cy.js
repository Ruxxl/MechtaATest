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

    it('Тестовый сценарии', () => {

        ProductPage.interceptRequests()

        cy.visit('/product/kofemashina-polaris-pacm-2056ac-chernyy/')

        ProductPage.check_gift_button()

    })

})