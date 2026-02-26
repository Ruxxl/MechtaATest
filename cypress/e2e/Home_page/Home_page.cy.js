import HomePage from "../../integration/pageObjects/home_page/home_page";

const homePage = new HomePage()

describe('Главная страница', () => {

  it('Открывает базовый URL', () => {
    cy.visit('/')                  // откроет https://pp.yc.mechta.kz/
    cy.url().should('include', 'pp.yc.mechta.kz')
  })

  it('Проверка запросов', () => {
    // Перехватываем все ключевые запросы
    homePage.interceptRequests()

    // Открываем страницу
    cy.visit('/')

    // Проверяем URL
    cy.url().should('include', 'pp.yc.mechta.kz')

    // Проверяем все запросы
    homePage.checkRequests()
  });

  it('Проверка шапки сайта', () => {
    cy.visit('/')
    homePage.Header
    homePage.checkImportantLinksVisible()
  })

  it('Проверка кнопки смены темы сайта', () => {
    cy.visit('/')
    cy.get('button[type="button"]')
        .eq(2)
        .should('be.visible')
        .and('not.be.disabled')
        .click()
  })

  it('Проверка кнопки смены языка сайта', () => {
    cy.visit('/')
    cy.contains('button', 'Кк')
        .first()
        .should('be.visible')
        .and('not.be.disabled')
        .click()
    cy.contains('button', 'Ру')
        .first()
        .should('be.visible')
        .and('not.be.disabled')
  })

  it('Проверка кнопки "Скачать приложение"', () => {
    cy.visit('/')
    cy.contains('button', 'Скачать приложение')
        .first()
        .should('be.visible')
        .click()
    cy.contains('p', 'Наведите камеру, чтобы скачать приложение').first()
        .should('be.visible')
  })

  it('Проверка Лого', () => {
    cy.visit('/')
    cy.get('a[aria-label="main\\ page"] svg')
        .should('be.visible')
        .click()
  })

  it('Проверка кнопки "Каталог"', () => {
    cy.visit('/')
    cy.contains('button', 'Каталог')
        .first()
        .should('be.visible')
        .click()
  })

  it('Проверка поле "Поиск"', () => {
    cy.visit('/')
    cy.get('[placeholder="Искать товары"]')
        .should('be.visible')
        .click()
    cy.contains('h3', 'Часто ищут')
        .first()
        .should('be.visible')
  })

  it('Проверка кнопки "Сравнение"', () => {
    cy.visit('/')
    cy.contains('p', 'Сравнение')
        .first()
        .should('be.visible')
        .click()
    cy.url().should('include', 'compare')
    cy.contains('h1', 'Сравнение товаров')
        .first()
        .should('be.visible')
  })

  it('Проверка кнопки "Избранное"', () => {
    cy.visit('/')
    cy.contains('a', 'Избранное')
        .first()
        .should('be.visible')
        .click()
    cy.url().should('include', 'favorites')
    cy.contains('h1', 'Избранное')
        .first()
        .should('be.visible')
  })

  it('Проверка кнопки "Корзина"', () => {
    cy.visit('/')
    cy.contains('p', 'Корзина')
        .first()
        .should('be.visible')
        .click()
    cy.url().should('include', 'basket')
    cy.contains('h1', 'Корзина')
        .first()
        .should('be.visible')
  })

  it('Все популярные категории видимы', () => {
    cy.visit('/')
    homePage.popularCategories
  })

  it('Проверка перехода на страницу Акции', () => {
    cy.visit('/')
    cy.get('img[alt="Акции"]').should('be.visible')
        .click()
    cy.url().should('include', '/useful/shares/')
    cy.contains('button', 'Популярные акции').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Cмартфоны Apple', () => {
    cy.visit('/')
    cy.get('img[alt="Смартфоны\\ Apple"]')
        .click()
    cy.url().should('include', '/section/smartfony/apple-iphone/')
    cy.contains('h1', 'Смартфоны Apple iPhone').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Cмартфоны', () => {
    cy.visit('/')
    cy.get('img[alt="Смартфоны"]')
        .click()
    cy.url().should('include', '/section/smartfony/')
    cy.contains('h1', 'Смартфоны').first()
        .should('be.visible')
        .click()
  })
})