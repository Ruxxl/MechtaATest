import HomePage from '../../../support/pageObjects/home_page';

const homePage = new HomePage();

// Главная страница — товарные карусели «Вы недавно смотрели»
// (GET /api/v3/personal/history) и «Специально для вас»
// (GET /api/v3/personal/recommendations).
// Разведка 2026-08-18: оба эндпоинта отдают { products: [...] } с полями
// name/slug/prices{basePrice,finalPrice}/discount/rating/userFlags
// {inBasket,inFavorite,inCompare}. Иконка "в корзину" — i-ph:shopping-cart,
// избранное — i-ph:heart (пусто) / i-ph:heart-fill (уже в избранном).
// Клик "в корзину" открывает модалку "Товар добавлен в корзину" +
// "Сопутствующие товары" (тот же паттерн, что и на странице товара) —
// перекрывает саму кнопку, поэтому успех проверяем через модалку + сверку
// с GET /api/v2/basket, а не через изменение текста/иконки кнопки под
// модалкой.

describe('Главная — «Вы недавно смотрели»', () => {
    it('Карточки товаров соответствуют GET /api/v3/personal/history (название/цена)', () => {
        cy.intercept('GET', '**/api/v3/personal/history').as('history');
        cy.login();
        cy.visit('/');
        cy.wait('@history', { timeout: 20000 }).then(({ response }) => {
            const products = response.body?.products || response.body;
            if (!Array.isArray(products) || products.length === 0) {
                cy.log('История просмотров пуста — кейс пропущен');
                return;
            }
            cy.contains('h2', 'Вы недавно смотрели').should('be.visible');
            const first = products[0];
            cy.contains(first.name).should('be.visible');
            const price = first.prices?.finalPrice ?? first.prices?.basePrice;
            if (price) {
                const grouped = String(price).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]');
                cy.contains(new RegExp(grouped)).should('be.visible');
            }
        });
    });

    it('Клик по иконке "в корзину" на карточке добавляет реальный товар в корзину', () => {
        cy.intercept('GET', '**/api/v3/personal/history').as('history');
        cy.login();
        cy.visit('/');
        cy.wait('@history', { timeout: 20000 }).then(({ response }) => {
            const products = response.body?.products || response.body;
            if (!Array.isArray(products) || products.length === 0) {
                cy.log('История просмотров пуста — кейс пропущен');
                return;
            }
            // Разведка 2026-08-18: тест гоняется на общем живом тестовом
            // аккаунте (cy.login() — один и тот же телефон 0000000000), его
            // корзина накапливает товары между прогонами. Если брать
            // products[0] не глядя, он рано или поздно оказывается УЖЕ в
            // корзине (userFlags.inBasket) — тогда клик по иконке корзины
            // не добавляет повторно, а ведёт на /basket/ (унесло с главной,
            // тест падал на поиске "Товар добавлен в корзину"). Берём
            // первый товар из истории, которого ЕЩЁ нет в корзине — тот же
            // паттерн, что и в тесте избранного ниже (userFlags.inFavorite).
            const target = products.find((p) => !p.userFlags?.inBasket) || products[0];
            if (products.every((p) => p.userFlags?.inBasket)) {
                cy.log('Все товары из истории уже в корзине — кейс пропущен');
                return;
            }

            // Разведка 2026-08-18: .closest('.group') неверен — у карточек
            // товаров НЕТ class="group" на предках рядом, group-hover:* есть
            // только у иконки корзины в самом ХЕДЕРЕ, поэтому .closest()
            // уезжал наружу карточки прямо на хедер. Прямая проверка живого
            // DOM (javascript_tool) показала: от ссылки с названием товара
            // ровно 3 уровня .parents('div') (т.е. .eq(2)) дают контейнер
            // "p-4 sm:p-6 p-5!" с ровно ОДНОЙ иконкой корзины внутри —
            // однозначный и надёжный скоуп именно этой карточки.
            // Важно: БЕЗ {force: true} — эта иконка НЕ скрыта до hover (в
            // отличие от стрелок баннера), так что force тут не нужен.
            // Живая проверка в браузере (обычный клик мышью) показала, что
            // именно force-клик был причиной прошлой нестабильности: товар
            // при force фактически добавлялся в корзину, но клик заодно
            // уводил на /basket/ и модалка "Товар добавлен в корзину" не
            // успевала показаться. Обычный (нефорсированный) клик со
            // штатным авто-скроллом Cypress отрабатывает штатно — модалка
            // показывается, навигации не происходит.
            cy.contains('a', target.name)
                .parents('div')
                .eq(2)
                .find('.iconify.i-ph\\:shopping-cart')
                .filter(':visible')
                .first()
                .click();

            cy.contains('Товар добавлен в корзину', { timeout: 15000 }).should('be.visible');
            cy.get('body').type('{esc}');

            // Сверяем не просто "корзина не пуста" (это тривиально верно —
            // корзина этого аккаунта уже накоплена с прошлых прогонов), а
            // что добавленный товар реально появился среди её позиций.
            cy.request({
                url: 'https://www.mechta.kz/api/v2/basket',
                headers: { Accept: 'application/json' },
            }).then(({ body }) => {
                // Разведка 2026-08-18: у позиции корзины (GET /api/v2/basket)
                // товар опознаётся полем `code` — это тот же URL-slug, что
                // `slug` в GET /api/v3/personal/history (проверено живьём).
                const items = body?.data?.items || [];
                const found = items.some((item) => item.code === target.slug);
                expect(found, `товар "${target.name}" появился в корзине`).to.be.true;
            });
        });
    });

    it('НЕГАТИВ: GET /api/v3/personal/history — 500 не роняет страницу (соседние блоки видны)', () => {
        cy.intercept('GET', '**/api/v3/personal/history', { statusCode: 500, body: {} }).as('historyError');
        cy.login();
        cy.visit('/');
        cy.wait('@historyError', { timeout: 20000 });
        homePage.header.should('be.visible');
        cy.contains('Популярные категории').should('be.visible');
        cy.get('main').should('not.contain.text', 'undefined');
    });

    it('НЕГАТИВ: пустая история (204/[]) не показывает секцию сломанной', () => {
        cy.intercept('GET', '**/api/v3/personal/history', { statusCode: 204, body: '' }).as('historyEmpty');
        cy.login();
        cy.visit('/');
        cy.wait('@historyEmpty', { timeout: 20000 });
        cy.get('main').should('not.contain.text', 'undefined');
    });
});

describe('Главная — «Специально для вас»', () => {
    it('Карточки товаров соответствуют GET /api/v3/personal/recommendations (название/цена/скидка)', () => {
        cy.intercept('GET', '**/api/v3/personal/recommendations').as('recommendations');
        cy.visit('/');
        cy.wait('@recommendations', { timeout: 20000 }).then(({ response }) => {
            const products = response.body?.products || response.body;
            if (!Array.isArray(products) || products.length === 0) {
                cy.log('Рекомендаций нет — кейс пропущен');
                return;
            }
            // Разведка 2026-08-18: этот же слот на странице рендерится ПОД
            // РАЗНЫМИ заголовками в зависимости от персонализации/сессии —
            // "Специально для вас" в одних случаях, "Хиты продаж" в других
            // (оба подтверждены живьём на одном и том же эндпоинте) —
            // принимаем любой из двух, а не жёстко один текст.
            cy.contains('h2', /Специально для вас|Хиты продаж/).should('be.visible');
            const first = products[0];
            cy.contains(first.name).should('be.visible');

            // Скидочный бейдж "-N%" — только если у товара реально есть
            // скидка И она округляется хотя бы до 1% (иначе UI резонно не
            // показывает бейдж "-0%" — сам этот edge-case пойман живым
            // прогоном 2026-08-18, это была ошибка в тесте, не баг сайта).
            if (first.discount && first.prices?.basePrice > first.prices?.finalPrice) {
                const pct = Math.round((1 - first.prices.finalPrice / first.prices.basePrice) * 100);
                if (pct >= 1) {
                    cy.contains(`-${pct}%`).should('exist');
                }
            }
        });
    });

    it('Товар, уже добавленный в избранное (userFlags.inFavorite), показывает закрашенное сердечко', () => {
        cy.intercept('GET', '**/api/v3/personal/recommendations').as('recommendations');
        cy.visit('/');
        cy.wait('@recommendations', { timeout: 20000 }).then(({ response }) => {
            const products = response.body?.products || response.body;
            const favored = (products || []).find((p) => p.userFlags?.inFavorite);
            if (!favored) {
                cy.log('Среди рекомендаций нет товара, уже отмеченного избранным — кейс пропущен');
                return;
            }
            // Тот же надёжный скоуп .parents('div').eq(2), что и в тесте
            // добавления в корзину выше (см. комментарий там) — вместо
            // .closest('.group'), который у карточек товаров не работает.
            cy.contains('a', favored.name)
                .parents('div')
                .eq(2)
                .find('.iconify.i-ph\\:heart-fill')
                .should('exist');
        });
    });

    it('НЕГАТИВ: GET /api/v3/personal/recommendations — 500 не роняет страницу', () => {
        cy.intercept('GET', '**/api/v3/personal/recommendations', { statusCode: 500, body: {} }).as('recommendationsError');
        cy.visit('/');
        cy.wait('@recommendationsError', { timeout: 20000 });
        homePage.header.should('be.visible');
        cy.get('main').should('not.contain.text', 'undefined');
    });
});
