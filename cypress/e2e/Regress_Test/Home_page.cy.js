import homePage from "../../integration/pageObjects/home_page";

describe('Главная страница', () => {

    beforeEach(() => {
        // Настраиваем перехваты перед каждым тестом
        homePage.interceptRequests();
    });

    it('Проверка базового состояния и API запросов', () => {
        cy.visit('/');
        cy.url().should('include', 'pp.yc.mechta.kz');
        
        // Проверяем все статусы API (один метод вместо кучи кода)
        homePage.checkRequests();
    });

    it('Проверка элементов шапки (Header)', () => {
        cy.visit('/');
        homePage.header.should('be.visible');
        homePage.checkImportantLinksVisible();
        
        // Проверка смены темы
        cy.get('button[type="button"]').eq(2).click(); 
        
        // Проверка смены языка
        cy.contains('button', 'Кк').first().click();
        cy.contains('button', 'Ру').first().should('be.visible');
    });

    it('Проверка модальных окон и поиска', () => {
        cy.visit('/');
        
        // Скачать приложение
        cy.contains('button', 'Скачать приложение').click();
        cy.contains('p', 'Наведите камеру').should('be.visible');
        cy.get('body').type('{esc}'); // Закрываем модалку

        // Поиск
        cy.get('[placeholder="Искать товары"]').click();
        cy.contains('h3', 'Часто ищут').should('be.visible');
    });

    it('Проверка навигации (Корзина/Избранное/Сравнение)', () => {
        const sections = [
            { name: 'Сравнение', url: 'compare', title: 'Сравнение товаров' },
            { name: 'Избранное', url: 'favorites', title: 'Избранное' },
            { name: 'Корзина', url: 'basket', title: 'Корзина' }
        ];

        sections.forEach(section => {
            cy.visit('/');
            cy.contains('p', section.name).should('be.visible').click({force: true});
            cy.url().should('include', section.url);
            cy.contains('h1', section.title).should('be.visible');
        });
    });

    it('Динамическая проверка популярных категорий из API', () => {
        cy.visit('/');
        // Этот метод сам пройдет по всем категориям, которые прислал бэкенд
        homePage.checkPopularCategories();
    });

    it('Проверка популярных брендов при скролле', () => {

        cy.intercept('GET', '**/api/v3/popular/brands').as('brands'); // Перехватываем запрос брендов
        cy.visit('/');
        cy.scrollTo('bottom', { duration: 2000 });
        
        cy.contains('h2', 'Популярные бренды').should('be.visible');
        // Проверяем все бренды на соответствие API
        homePage.checkPopularBrands();
    });

    it('Проверка футера и подписки', () => {
        cy.visit('/');
        cy.scrollTo('bottom');
        
        cy.get('img[alt="preview\\ app\\ photo"]').should('be.visible');
        cy.contains('button', 'Подписаться').should('be.visible');
    });
});