import productPage from '../../integration/pageObjects/product_page';

const ProductPage = new productPage()

describe('Страница товара', () => {
  beforeEach(() => {
    cy.session('base-home', () => {
      cy.visit('/');
    });
  });

  it('Открывает страницу товара', () => {

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    cy.url().should('include', 'product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium')

    cy.contains('button', 'В корзину', {timeout:20000}).first().should('be.visible')

  })

  it('Проверка всех необходимых API-запросов', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.wait_requests()

  })

  it('Проверка название товара сравнение с API', () => {

    ProductPage.interceptRequests()
    
    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_name()

  })

  it('Проверка стикера товара сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_sticker()

  })
})