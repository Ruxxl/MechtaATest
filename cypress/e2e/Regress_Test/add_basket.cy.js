import HomePage from "../../integration/pageObjects/home_page/home_page";

const homePage = new HomePage()

describe('Главная страница', () => {

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
    cy.visit('/')
    cy.contains('a', 'Смартфоны Apple').first()
    .click()
    cy.get('div.rounded-lg.rounded-mi-l > div.p-4.sm\\:p-6:nth-of-type(2) > div.w-full.h-full > div.relative.flex > a.w-full.justify-center:nth-of-type(2)').eq(0)
    .click()

    cy.contains('button', 'В корзину').first()
    .click()

    cy.contains('span', 'В корзине').first()
    .should('be.visible')
    
    cy.contains('li', 'Товар добавлен в корзину').first()
    .should('be.visible')
  })
})