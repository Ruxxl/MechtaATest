import productPage from '../../support/pageObjects/product_page';

const ProductPage = new productPage()

// Товары-фикстуры берутся из cypress/fixtures/products.json,
// чтобы при смене наличия/акций на сайте достаточно было поправить один файл
let product_page;
let product_page_with_reviews;
let product_page_with_gift;
let product_page_with_discount;

describe('Страница товара', () => {
  before(() => {
    cy.fixture('products').then((products) => {
      product_page = products.inStock.url;
      product_page_with_reviews = products.withReviews.url;
      product_page_with_gift = products.withGift.url;
      product_page_with_discount = products.withDiscount.url;
    });
  });

  beforeEach(() => {
    cy.session('base-home', () => {
      cy.visit('/');
    });
  });

  it('Открывает страницу товара', () => {

    cy.visit(product_page)

    cy.url().should('include', product_page)

    cy.get('#product-add-to-basket').should('be.visible')
      .should('include.text', 'В корзину')

  })

  it('Проверка всех необходимых API-запросов', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.wait_requests()

  })

  it('Проверка название товара сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_product_name()

  })

  it('Проверка стикера Оф.товар сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_official_product_sticker()

  })

  it('Проверка стикера Выгода сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page_with_discount)

    ProductPage.check_discount_product_sticker()

  })

  it('Проверка кнопки копирования названия товара', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_productName_copy_button()

  })

  it('Проверка  отображения количества отзывова внизу название товара', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page_with_reviews)

    ProductPage.check_reviews()

  })

  it('Проверка основных характеристик сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_main_properties()

  })

  it('Проверка отображение "На ветрине" сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_only_shop_sticker()

  })

  it('Проверка цены со скидкой сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_product_finalPrice()

  })

  it('Проверка цены без скидки сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page_with_discount)

    ProductPage.check_product_basePrice()

  })

  it('Проверка фишек товара сравнение с API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_product_fishki()

  })

  it('Проверка наличия кнопки "Купить сейчас"', () => {

    cy.visit(product_page)

    cy.get('#product-buy-now').should('be.visible')
      .should('include.text', 'Купить сейчас')

  })

  it('Проверка наличия кнопки "В корзину"', () => {

    cy.visit(product_page)

    cy.get('#product-add-to-basket').should('be.visible')
      .should('include.text', 'В корзину')

  })

  it('Проверка кнопки "Все характеристики"', () => {

    cy.visit(product_page)

    ProductPage.check_vse_charakteristiki()

  })

  it('Проверка значении кредита', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_product_credit_value()

  })

  it('Проверка кнопки самовывоза кол-во магазинов', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_shops_button()

  })

  it('Проверка отображении Доступно на самовывоз только на витрине проверка API', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_only_shop_adresses()

  })

  it('Проверка отображении Экспресс доставка', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_express_delivery()

  })

  it('Проверка отображения текста Эксрпресс доставки', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page)

    ProductPage.check_express_delivery_text()

  })

  it('Проверка выбора подарка', () => {

    ProductPage.interceptRequests()

    cy.visit(product_page_with_gift)

    ProductPage.check_gift_button()
  })

  describe('Негативные кейсы', () => {

    it('Товар без скидки: стикер "Выгода" не отображается', () => {
      cy.visit(product_page)
      ProductPage.assertNoDiscountSticker()
    })

    it('Товар без подарка: кнопка выбора подарка не отображается', () => {
      cy.visit(product_page)
      ProductPage.assertNoGiftButton()
    })

    it('Товар без отзывов: счётчик отзывов не отображается', () => {
      cy.visit(product_page)
      ProductPage.assertNoReviewsCount()
    })

    it('Несуществующий товар: страница товара недоступна', () => {
      cy.fixture('testData').then((testData) => {
        cy.visit(testData.nonExistentProductUrl, { failOnStatusCode: false })
        cy.get('#product-add-to-basket').should('not.exist')
        cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible')
      })
    })
  })

})