import { waitAndAssertStatus, waitOptional } from '../helpers/apiAssertions';

class HomePage {
    constructor() {
        // Эндпоинты, которые реально уходят СРАЗУ при первой загрузке главной
        // (SSR/начальный CSR) — их ждёт checkRequests() без скролла/действий.
        this.endpoints = {
            seoResolve: ['POST', '**/api/seo-resolve'],
            headerInfo: ['GET', '**/api/v2/header/info'],
            headerCities: ['GET', '**/api/v2/header/cities'],
            basket: ['GET', '**/api/v2/basket'],
            // ВАЖНО (аудит 2026-08-18): раньше здесь стоял /api/v2/favorites —
            // живая проверка (cy.intercept('**/api/**') + полный скролл)
            // показала, что фронт реально зовёт v3, не v2. С v2 этот alias
            // молча никогда не ловил трафик (favorites в
            // optionalForAnonymous, поэтому раньше это не роняло тест, а
            // просто тихо ничего не проверяло).
            favorites: ['GET', '**/api/v3/favorites'],
            user: ['GET', '**/api/v2/user'],
            catalogMenu: ['GET', '**/api/v3/catalog/menu'],
            popularTop: ['GET', '**/api/v3/popular/top-categories**'],
            popularCategories: ['GET', '**/api/v3/popular/categories'],
            banners: ['GET', '**/api/v3/publications/banners'],
            recommendations: ['GET', '**/api/v3/personal/recommendations'],
            history: ['GET', '**/api/v3/personal/history'],
            catalogOffers: ['GET', '**/api/v3/catalog/offers**'],
            catalogMeta: ['GET', '**/api/v3/catalog/meta**'],
            compareSmall: ['GET', '**/api/v2/compare/small'],
        };

        // Эндпоинты, срабатывающие ТОЛЬКО по конкретному действию (скролл до
        // блока, авторизация) — живая разведка 2026-08-18 (cy.intercept('**/api/**')
        // + полный постраничный скролл) подтвердила: если зарегистрировать их
        // в this.endpoints и гонять через checkRequests() без соответствующего
        // действия, тест упадёт по таймауту, т.к. запрос ещё не отправлен.
        // Каждый ждётся отдельно в своём тесте (см. wait{Alias}() ниже).
        this.lazyEndpoints = {
            popularBrands: ['GET', '**/api/v3/popular/brands'],
            publications: ['GET', '**/api/v3/publications'],
            ordersActiveCount: ['GET', '**/api/v3/orders/active-count'],
        };

        this.importantLinks = ['/mechta-shops/', 'https://b2b.mechta.kz/', '/faq/'];
    }

    // 1. Динамический интерцепт — регистрирует ОБА набора алиасов сразу
    // (lazy тоже нужно заинтерсептить ДО visit, иначе Cypress не поймает
    // запрос, даже если реально дождаться его позже конкретным действием)
    interceptRequests() {
        Object.entries({ ...this.endpoints, ...this.lazyEndpoints }).forEach(([alias, [method, path]]) => {
            cy.intercept(method, path).as(alias);
        });
    }

    // 2. Оптимизированная проверка всех запросов (только "быстрые" — см. коммент у this.endpoints)
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
                // Разведка 2026-08-18: анонимная сессия на /api/v3/favorites
                // реально получает 204 (No Content), не 200 — дефолт
                // waitOptional() ([200]) с этим не совпадал.
                waitOptional(alias, { timeout: 15000, expectedStatuses: [200, 204] });
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
        return cy.wait('@popularBrands').then(({ response }) => {
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

    // --- Хедер: город ---

    // Разведка 2026-08-18 (DOM-инспекция через javascript_tool): "Астана" в
    // шапке — сам текст <button>, а не соседняя иконка, клик по нему
    // напрямую открывает модалку выбора города.
    openCitySelector() {
        cy.contains('button', 'Астана').click();
        cy.contains('Выберите ваш город').should('be.visible');
        // "Найти город" — это placeholder <input>, а не текстовый контент
        // элемента, cy.contains() его в принципе не находит (искал по
        // ошибке в первой версии теста) — модалка реально открыта, как
        // только виден заголовок и сам инпут с этим placeholder'ом.
        cy.get('input[placeholder="Найти город"]').should('be.visible');
        return this;
    }

    // --- Хедер: каталог-меню ---

    openCatalogMenu() {
        cy.contains('button', 'Каталог').click();
        return this;
    }

    closeCatalogMenu() {
        cy.contains('button', 'Каталог').click();
        return this;
    }

    // --- Хедер: поиск ---

    getSearchInput() {
        return cy.get('[placeholder="Искать товары"]');
    }

    // --- Хедер: счётчики (Заказы/Сравнение/Избранное/Корзина) ---

    // Каждый бейдж — маленький числовой лейбл рядом/поверх иконки в шапке.
    // Разведка 2026-08-18: подписи под иконками — <p>Заказы</p>/<p>Сравнение</p>/
    // <p>Избранное</p>/<p>Корзина</p>, число бейджа — ближайший текстовый узел
    // с классом бейджа внутри того же родителя-ссылки/кнопки.
    getHeaderBadgeByLabel(label) {
        return cy.contains('p', label).parents('a, button').first();
    }
}

export default HomePage;