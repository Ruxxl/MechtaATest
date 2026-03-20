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

    cy.get('#product-add-to-basket').should('be.visible')
      .should('include.text', 'В корзину')

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

  it('Проверка стикера Оф.товар сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_official_product_sticker()

  })

  it('Проверка стикера Выгода сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_discount_product_sticker()

  })

  it('Проверка кнопки копирования названия товара', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_productName_copy_button()

  })

  it('Проверка  отображения количества отзывова внизу название товара', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_reviews()

  })

  it('Проверка основных характеристик сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_main_properties()

  })

  it('Проверка отображение "На ветрине" сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_only_shop_sticker()

  })

  it('Проверка цены со скидкой сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_finalPrice()

  })

  it('Проверка цены без скидки сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_basePrice()

  })

  it('Проверка фишек товара сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_fishki()

  })

  it('Проверка наличия кнопки "Купить сейчас"', () => {

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    cy.get('#product-buy-now').should('be.visible')
      .should('include.text', 'Купить сейчас')

  })

  it('Проверка наличия кнопки "В корзину"', () => {

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    cy.get('#product-add-to-basket').should('be.visible')
      .should('include.text', 'В корзину')

  })

  it('Проверка кнопки "Все характеристики"', () => {

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_vse_charakteristiki()

  })

  it('Проверка значении кредита', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_product_credit_value()

  })

  it('Проверка кнопки самовывоза кол-во магазинов', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_shops_button()

  })

  it('Проверка отображении Доступно на самовывоз только на витрине проверка API', () => {

    ProductPage.interceptRequests()

    cy.visit('/product/smartfon-apple-iphone-16-pro-max-256gb-natural-titanium/')

    ProductPage.check_only_shop_adresses()

  })


})