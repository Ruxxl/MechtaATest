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
    cy.visit('/').wait(2000)
    cy.get('img[alt="Акции"]').should('be.visible')
        .click()
    cy.url().should('include', '/useful/shares/')
    cy.contains('button', 'Популярные акции').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Cмартфоны Apple', () => {
    cy.visit('/').wait(2000)
    cy.get('img[alt="Смартфоны\\ Apple"]')
        .click()
    cy.url().should('include', '/section/smartfony/apple-iphone/')
    cy.contains('h1', 'Смартфоны Apple iPhone').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Cмартфоны', () => {
    cy.visit('/').wait(2000)
    cy.get('img[alt="Смартфоны"]')
        .click()
    cy.url().should('include', '/section/smartfony/')
    cy.contains('h1', 'Смартфоны').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Наушники', () => {
    cy.visit('/')
    cy.get('img[alt="Наушники"]')
        .click()
    cy.url().should('include', '/section/naushniki/')
    cy.contains('h1', 'Наушники').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Ноутбуки', () => {
    cy.visit('/')
    cy.get('img[alt="Ноутбуки"]')
        .click()
    cy.url().should('include', '/section/noutbuki/')
    cy.contains('h1', 'Ноутбуки').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Пылесосы', () => {
    cy.visit('/')
    cy.get('img[alt="Пылесосы"]')
        .click()
    cy.url().should('include', '/section/uborka-doma/')
    cy.contains('h1', 'Техника для уборки дома').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Стиральные машины', () => {
    cy.visit('/')
    cy.get('img[alt="Стиральные\\ машины"]')
        .click()
    cy.url().should('include', '/section/stiralnye-mashiny/')
    cy.contains('h1', 'Стиральные машины').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Телевизоры', () => {
    cy.visit('/')
    cy.get('img[alt="Телевизоры"]')
        .click()
    cy.url().should('include', '/section/televizory/')
    cy.contains('h1', 'Телевизоры').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Аэрогрили', () => {
    cy.visit('/')
    cy.get('img[alt="Аэрогрили"]')
        .click()
    cy.url().should('include', '/section/aerogrili/')
    cy.contains('h1', 'Аэрогрили').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Холодильники', () => {
    cy.visit('/')
    cy.get('img[alt="Холодильники"]')
        .click()
    cy.url().should('include', '/section/holodilniki/')
    cy.contains('h1', 'Холодильники').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Электрические чайники', () => {
    cy.visit('/')
    cy.get('img[alt="Чайники"]')
        .click()
    cy.url().should('include', '/section/elektricheskie-chayniki/')
    cy.contains('h1', 'Электрические чайники').first()
        .should('be.visible')
        .click()
  })

  it('Проверка перехода на Планшеты', () => {
    cy.visit('/')
    cy.get('img[alt="Планшеты"]')
        .click()
    cy.url().should('include', '/section/planshety/')
    cy.contains('h1', 'Планшеты').first()
        .should('be.visible')
        .click()
  })

  it('Проверка отображения Рекомендации', () => {
    cy.visit('/')
    cy.contains('h2', 'Хиты продаж').first()
        .should('be.visible')
        .click()
  })

  it('Проверка отображения Популярные бренды', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 5000 });
    cy.contains('h2', 'Популярные бренды', { timeout: 10000 })
        .should('exist')
        .should('be.visible')

    cy.get('a[aria-label="Visit\\ Samsung"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
    cy.get('a[aria-label="Visit\\ Bork"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
    cy.get('a[aria-label="Visit\\ Apple"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
    cy.get('a[aria-label="Visit\\ Xiaomi"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
    cy.get('a[aria-label="Visit\\ LG"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
    cy.get('a[aria-label="Visit\\ HONOR"] > img.group-has-hover\\:scale-88.transition-all').should('be.visible')
  })

  it('Проверка перехода на Brand Samsung', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 2000 });
    cy.get('a[aria-label="Visit\\ Samsung"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/samsung/')
    cy.get('img[alt="samsung"]').eq(0)
        .should('be.visible')
  })

  it('Проверка перехода на Brand Bork', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 5000 });
    cy.get('a[aria-label="Visit\\ Bork"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/bork/')
    //cy.contains('h1', 'Bork').first()
        //.should('be.visible')
       //.click()
  })

  it('Проверка перехода на Brand Apple', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 2000 });
    cy.get('a[aria-label="Visit\\ Apple"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/apple/')
    cy.contains('div', 'iPhone').first()
        .should('be.visible')
  })

  it('Проверка перехода на Brand Xiaomi', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 2000 });
    cy.get('a[aria-label="Visit\\ Xiaomi"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/xiaomi/')
  })

  it('Проверка перехода на Brand LG', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 2000 });
    cy.get('a[aria-label="Visit\\ LG"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/lg/')
  })

  it('Проверка перехода на Brand Honor', () => {
    cy.visit('/')
    cy.scrollTo('bottom', { duration: 2000 });
    cy.get('a[aria-label="Visit\\ HONOR"] > img.group-has-hover\\:scale-88.transition-all')
        .click()
    cy.url().should('include', '/brands/honor/')
  })

  it('Проверка отображения раздела "Смартфоны"', () => {
    cy.visit('/')

    cy.scrollTo('bottom', { duration: 2000 });
    cy.contains('h2', 'Смартфоны')
        .first().should('be.visible')
  })

  it('Проверка отображения раздела "Обогреватели"', () => {
    cy.visit('/')

    cy.scrollTo('bottom', { duration: 2000 });
    cy.contains('h2', 'Обогреватели')
        .first().should('be.visible')
  })

  it('Проверка отображения раздела "Cкачайте приложение"', () => {
    cy.visit('/')

    cy.scrollTo('bottom', {duration: 500});
    cy.scrollTo('bottom', {duration: 500});
    cy.get('img[alt="preview\\ app\\ photo"]')
        .should('be.visible')
  })

  it('Проверка отображения раздела "Подпись на рассылку"', () => {
    cy.visit('/')

    cy.scrollTo('bottom', {duration: 500});
    cy.scrollTo('bottom', {duration: 500});
    cy.contains('button', 'Подписаться').first().should('be.visible')
  })

})