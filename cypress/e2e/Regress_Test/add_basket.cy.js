import HomePage from "../../integration/pageObjects/home_page";
import add_basket from "../../integration/pageObjects/add_basket";

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

        cy.url().should('include', '/basket')

      } else if (hasInCart) {

        cy.log('Кнопка: Уже в корзине');

        cy.contains('button', 'В корзине')
          .should('be.visible')
          .click();
        cy.url().should('include', '/basket')

      } else {

        throw new Error('❌ Не найдена ни одна кнопка');

      }
    });
  })

})