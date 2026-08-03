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

        Object.keys(this.endpoints).forEach(alias => {
            if (optionalForAnonymous.includes(alias)) {
                cy.get(`@${alias}.all`, { timeout: 15000 }).then((interceptions) => {
                    if (interceptions.length === 0) {
                        cy.log(`ℹ️ ${alias}: запрос не отправлен (ожидаемо для анонимной сессии)`);
                        return;
                    }
                    expect(interceptions[0].response?.statusCode).to.eq(200);
                    cy.log(`✅ ${alias}: ${interceptions[0].response?.statusCode}`);
                });
                return;
            }

            cy.wait(`@${alias}`, { timeout: 15000 }).then(({ response }) => {
                const status = response?.statusCode;

                // Используем switch для гибкой логики статусов
                switch (alias) {
                    case 'user':
                        expect(status).to.be.oneOf([200, 401]);
                        break;
                    case 'history':
                        expect(status).to.be.oneOf([200, 204]);
                        break;
                    default:
                        expect(status).to.eq(200);
                }
                cy.log(`✅ ${alias}: ${status}`);
            });
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
}

export default HomePage;