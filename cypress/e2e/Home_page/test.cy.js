import productPage from '../../integration/pageObjects/product_page';

const ProductPage = new productPage()
describe('Главная страница', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it ('Проверка отображение "На ветрине" сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_main_properties()
    
  })
})