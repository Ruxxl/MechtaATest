import HomePage from "../../support/pageObjects/home_page";
import add_basket from "../../support/pageObjects/add_basket";
import { assertInvalidPhoneShowsValidationError } from "../../support/helpers/authModal";

const homePage = new HomePage()
const Add_basket = new add_basket()

describe('Добавление товара в корзину', () => {

  beforeEach(() => {
    cy.session('base-home', () => {
      homePage.interceptRequests(); // перехваты ДО visit
      cy.visit('/');
    });
  });

  it('Открывает базовый URL', () => {

    cy.visit('/')
    cy.url().should('include', 'pp.yc.mechta.kz')
  })

  it('Добавить товар в корзину', () => {

    cy.login()

    cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/');

    cy.wait(10000)

    cy.dismissPromoModal();

    cy.get('body').then(($body) => {

      const hasAddBtn = $body.find('button:contains("В корзину")').length > 0;
      const hasInCart = $body.find('button:contains("В корзине")').length > 0;

      if (hasAddBtn) {

        cy.log('Кнопка: В корзину');

        // {force: true}: промо-модалка (подписка на уведомления) может выскочить
        // асинхронно уже после проверки dismissPromoModal и перекрыть кнопку своим
        // оверлеем — из-за него даже .should('be.visible') считает кнопку невидимой.
        // Поэтому не проверяем видимость клика, а ждём подтверждения от самого
        // API добавления в корзину — это надёжнее визуальной проверки
        cy.intercept('POST', '**/api/v2/basket/add').as('addToBasketMain');
        cy.get('#product-add-to-basket').click({
          force: true
        });
        cy.wait('@addToBasketMain', { timeout: 20000 });

        cy.dismissAccessoryUpsell();
        // Промо-модалка могла выскочить и здесь — перепроверяем ещё раз
        cy.dismissPromoModal();

        cy.contains('button', 'В корзине', {
            timeout: 20000
          })
          .click({ force: true });

        cy.url().should('include', '/basket')

      } else if (hasInCart) {

        cy.log('Кнопка: Уже в корзине');

        cy.contains('button', 'В корзине')
          .click({ force: true });
        cy.url().should('include', '/basket')

      } else {

        throw new Error('❌ Не найдена ни одна кнопка');

      }
    });
  })

  describe('Негативные кейсы', () => {

    let testData;

    before(() => {
      cy.fixture('testData').then((data) => {
        testData = data;
      });
    });

    it('Несуществующий товар: показывает страницу 404', () => {
      // "404" на странице — картинка, а не текст, поэтому проверяем реальный текст
      cy.visit(testData.nonExistentProductUrl, { failOnStatusCode: false });
      cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible');
      cy.contains('button, a', 'Вернуться на сайт').should('be.visible');
    });

    it('Пустая корзина показывает состояние "Корзина пуста"', () => {
      // Корзина этого гостя могла быть заполнена другими тестами в этом файле —
      // явно вычищаем её, чтобы тест не зависел от порядка выполнения
      Add_basket.emptyBasket();
      Add_basket.assertEmptyBasketState();
    });

    it('Количество товара в корзине нельзя уменьшить меньше 1', () => {
      cy.login();
      cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/');
      cy.wait(10000);
      cy.dismissPromoModal();
      Add_basket.addProductToBasketIfNeeded();

      cy.visit('/basket');
      Add_basket.assertQuantityCannotGoBelowOne();
    });

    it('Попытка оформить заказ из корзины без авторизации открывает окно входа, а не редиректит', () => {
      cy.visit('/product/smartfon-apple-iphone-15-128gb-pink/');
      cy.wait(10000);
      cy.dismissPromoModal();
      Add_basket.addProductToBasketIfNeeded();

      cy.visit('/basket');
      Add_basket.clickCheckoutAnonymously();
      // Важно: в отличие от прямого захода на /checkout/, здесь НЕТ редиректа на главную
      cy.url().should('include', '/basket');
    });

    it('Невалидный номер телефона при входе показывает ошибку валидации', () => {
      cy.visit('/');
      cy.contains('button, p', 'Войти').first().click();
      assertInvalidPhoneShowsValidationError(testData.invalidPhones.tooShort);
    });

    it('Пустой номер телефона при входе показывает ошибку валидации', () => {
      cy.visit('/');
      cy.contains('button, p', 'Войти').first().click();
      assertInvalidPhoneShowsValidationError(testData.invalidPhones.empty);
    });
  });

})