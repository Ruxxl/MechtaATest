import { waitAndAssertStatus, waitOptional } from '../helpers/apiAssertions';

class HomePage {
    constructor() {
        // Объект конфигурации: алиас -> эндпоинт
        this.endpoints = {
            seoResolve: ['POST', '**/api/seo-resolve'],
            headerInfo: ['GET', '**/api/v2/header/info'],
            headerCities: ['GET', '**/api/v2/header/cities'],
            basket: ['GET', '**/api/v2/basket'],
            favorites: ['GET', '**/api/v2/favorites'],
            user: ['GET', '**/api/v2/user'],
            catalogMenu: ['GET', '**/api/v3/catalog/menu'],
            popularTop: ['GET', '**/api/v3/popular/top-categories**'],
            popularCategories: ['GET', '**/api/v3/popular/categories'],
            banners: ['GET', '**/api/v3/publications/banners'],
            recommendations: ['GET', '**/api/v3/personal/recommendations'],
            history: ['GET', '**/api/v3/personal/history'],
            catalogOffers: ['GET', '**/api/v3/catalog/offers**'],
            catalogMeta: ['GET', '**/api/v3/catalog/meta**'],
            compareSmall: ['GET', '**/api/v2/compare/small']        };

        this.importantLinks = ['/mechta-shops/', 'https://b2b.mechta.kz/', '/faq/'];
    }

    // 1. Динамический интерцепт
    interceptRequests() {
        Object.entries(this.endpoints).forEach(([alias, [method, path]]) => {
            cy.intercept(method, path).as(alias);
        });
    }

    // 2. Оптимизированная проверка всех запросов
    // Убрали cy.wait(10000). Cypress сам подождет появления запросов.
    checkRequests() {
        // Для анонимной сессии (без cy.login()) бэкенд вообще не шлёт этот запрос,
        // поэтому его нельзя ждать наравне с остальными — cy.wait упадёт по таймауту
        const optionalForAnonymous = ['favorites'];

        // Статусы, ожидаемые для конкретных алиасов, отличных от дефолтного [200]
        const expectedStatusesByAlias = {
            user: [200, 401],
            history: [200, 204],
        };

        Object.keys(this.endpoints).forEach(alias => {
            if (optionalForAnonymous.includes(alias)) {
                waitOptional(alias, { timeout: 15000 });
                return;
            }

            waitAndAssertStatus(alias, expectedStatusesByAlias[alias] || [200], { timeout: 15000 });
        });
    }

    // 3. Проверка популярных категорий (переделано в метод)
    checkPopularCategories() {
        return cy.wait('@popularCategories').then(({ response }) => {
            const categories = response.body;

            categories.forEach((item) => {
                const urlPath = new URL(item.url).pathname;
                
                // Ищем ссылку, которая содержит путь и текст категории
                cy.get(`a[href*="${urlPath}"]`)
                    .should('be.visible')
                    .and(($a) => {
                        const content = ($a.attr('aria-label') || $a.text()).toLowerCase();
                        expect(content).to.contain(item.title.toLowerCase());
                    });
            });
        });
    }

    // 4. Проверка брендов
    checkPopularBrands() {

        return cy.wait('@brands').then(({ response }) => {
            response.body.forEach((brand) => {
                cy.get(`a[href*="/brands/${brand.slug}"]`)
                    .should('be.visible')
                    .and('attr', 'aria-label', `Visit ${brand.name}`);
            });
        });
    }

    // 5. Простые элементы и ссылки
    get header() {
        return cy.get('#reka-popover-trigger-v-0-0-0');
    }

    checkImportantLinksVisible() {
        this.importantLinks.forEach(link => {
            cy.get(`a[href="${link}"]`).should('be.visible');
        });
    }

    // --- Негативные кейсы ---

    // Поиск по запросу без совпадений: сайт не показывает пустой список,
    // а рендерит отдельный экран "Ой, а мы ничего не нашли!"
    assertSearchNoResults(query) {
        cy.get('[placeholder="Искать товары"]').click().type(query);
        cy.get('[placeholder="Искать товары"]').type('{enter}');
        cy.url().should('include', '/search/');
        cy.contains('Ой, а мы ничего не нашли').should('be.visible');
    }
}

export default HomePage;