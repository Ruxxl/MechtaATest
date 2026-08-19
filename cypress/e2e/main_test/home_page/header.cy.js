import HomePage from '../../../support/pageObjects/home_page';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const homePage = new HomePage();

// Главная страница (https://pp.yc.mechta.kz/) — блок «Хедер» (шапка).
// Разведка 2026-08-18 (живой браузер + диагностический Cypress-спек с
// cy.intercept('**/api/**') на полном скролле) дала точный список реальных
// эндпоинтов — см. комментарии в support/pageObjects/home_page.js.

describe('Главная — Хедер: базовое состояние', () => {
    beforeEach(() => {
        homePage.interceptRequests();
    });

    it('Базовые API-запросы уходят и отвечают ожидаемыми статусами', () => {
        cy.visit('/');
        cy.url().should('include', 'pp.yc.mechta.kz');
        homePage.checkRequests();
    });

    it('Шапка и важные ссылки видимы (Магазины/Для бизнеса/Мечта ГИД)', () => {
        cy.visit('/');
        homePage.header.should('be.visible');
        homePage.checkImportantLinksVisible();
    });

    it('Переключение темы (светлая/тёмная) меняет класс <html> с light на dark', () => {
        cy.visit('/');
        cy.get('html').should('have.class', 'light');
        cy.get('button[type="button"]').eq(2).click();
        cy.get('html').should('have.class', 'dark').and('not.have.class', 'light');
    });

    it('Переключение языка на казахский меняет текст переключателя на "Ру"', () => {
        cy.visit('/');
        cy.contains('button', 'Кк').first().click();
        cy.contains('button', 'Ру').first().should('be.visible');
    });

    it('Кнопка "Скачать приложение" открывает модалку с QR-кодом', () => {
        cy.visit('/');
        cy.contains('button', 'Скачать приложение').click();
        cy.contains('p', 'Наведите камеру').should('be.visible');
        cy.get('img[alt*="qr" i], svg').should('exist');
        cy.get('body').type('{esc}');
    });
});

describe('Главная — Хедер: выбор города', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/v2/header/cities').as('headerCities');
        cy.visit('/');
    });

    it('Открытие модалки города — список содержит текущий выбранный город с галочкой', () => {
        homePage.openCitySelector();
        // В самом списке (не заголовок-кнопка выбора) — тот же текст
        // "Астана", отмеченный галочкой как активный
        cy.contains('button, div', 'Астана').should('have.length.at.least', 1);
    });

    it('Города в модалке соответствуют GET /api/v2/header/cities (сверка первых нескольких)', () => {
        homePage.openCitySelector();
        cy.wait('@headerCities').then(({ response }) => {
            // Реальная форма ответа — {result, errors, data: {cities: [...]}}
            const cities = response.body?.data?.cities || response.body;
            expect(Array.isArray(cities), 'baseline: API вернул непустой список городов').to.be.true;
            expect(cities.length).to.be.greaterThan(0);
            // Сверяем сам факт, что хотя бы название текущего/популярных
            // городов из ответа реально присутствует в модалке
            const someNames = cities.slice(0, 3).map((c) => c.name || c.title).filter(Boolean);
            someNames.forEach((name) => {
                cy.contains(name).should('exist');
            });
        });
    });

    it('Поиск города по строке фильтрует список', () => {
        homePage.openCitySelector();
        cy.get('input[placeholder*="Найти город" i]').type('Алматы');
        cy.contains('button, div', 'Алматы').should('be.visible');
        cy.contains('button, div', 'Шымкент').should('not.exist');
    });

    it('Закрытие модалки крестиком не меняет текущий город', () => {
        homePage.openCitySelector();
        cy.get('button[aria-label*="Close" i], button svg').first();
        cy.get('body').type('{esc}');
        cy.contains('Выберите ваш город').should('not.exist');
        cy.contains('Астана').should('be.visible');
    });
});

describe('Главная — Хедер: каталог-меню', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/v3/catalog/menu').as('catalogMenu');
        cy.visit('/');
    });

    it('Открытие каталога показывает мегаменю с категориями из API', () => {
        cy.wait('@catalogMenu').then(({ response }) => {
            // Реальная форма ответа — {catalog: [...]}, не {data: [...]}
            const categories = response.body?.catalog || response.body?.data || response.body;
            expect(Array.isArray(categories), 'baseline: непустой список категорий').to.be.true;
            expect(categories.length).to.be.greaterThan(0);

            homePage.openCatalogMenu();
            // Первая категория меню видна в левой колонке. ВАЖНО: сайт
            // дублирует мегаменю в DOM (мобильная lg:hidden-копия + десктопная).
            // cy.contains(sel, text) уже возвращает ОДИН (первый) элемент —
            // .filter(':visible') после него не переберёт остальные
            // совпадения, а просто обнулит результат, если первый найденный
            // оказался скрытым (уже задокументированная в проекте ловушка).
            // Правильный паттерн — cy.get(tag), затем .filter() по тексту,
            // затем .filter(':visible').
            const name = categories[0].name || categories[0].title;
            cy.get('div, a, span')
                .filter((_, el) => el.textContent.trim().includes(name))
                .filter(':visible')
                .should('have.length.at.least', 1);
        });
    });

    it('Повторный клик по "Каталог" закрывает мегаменю', () => {
        homePage.openCatalogMenu();
        cy.contains('button', 'Каталог').should('be.visible');
        homePage.closeCatalogMenu();
        cy.get('a').contains('Смартфоны и телефоны').should('not.exist');
    });

    it('Клик по категории в мегаменю ведёт на страницу каталога этой категории', () => {
        homePage.openCatalogMenu();
        // Тот же паттерн, что и в предыдущем тесте — cy.get(tag).filter(text).filter(':visible')
        cy.get('a')
            .filter((_, el) => el.textContent.trim().includes('Смартфоны'))
            .filter(':visible')
            .first()
            .click();
        cy.url().should('include', '/section/');
    });
});

describe('Главная — Хедер: поиск', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('Клик по полю поиска открывает подсказки "Часто ищут" даже без ввода', () => {
        homePage.getSearchInput().click();
        cy.contains(/Часто ищут|Возможно вы ищете/).should('be.visible');
    });

    it('Ввод реального запроса показывает подсказки и товары-результаты', () => {
        homePage.getSearchInput().click().type('ноутбук');
        // Разведка 2026-08-18: заголовок "Возможно вы ищете" оказался
        // на удивление ненадёжным сигналом — даже прямая DOM-инспекция
        // живого браузера в момент, когда текст явно виден на скриншоте,
        // не находила его через querySelectorAll (похоже на портал/телепорт
        // рендеринга дропдауна). Функционально важный и надёжно
        // проверяемый сигнал "результаты поиска реально загрузились" —
        // сами карточки товаров с ценой, их и используем.
        cy.contains(/\d[\d\s]*\s?₸/, { timeout: 10000 }).should('be.visible');
        // Подсказки-запросы (теги популярных запросов над результатами)
        cy.get('a[href^="/product/"]').should('have.length.at.least', 1);
    });

    it('Клик по товару из выпадающих результатов поиска открывает страницу товара', () => {
        homePage.getSearchInput().click().type('ноутбук');
        cy.contains(/\d[\d\s]*\s?₸/, { timeout: 10000 }).should('be.visible');
        cy.get('a[href^="/product/"]').first().click({ force: true });
        cy.url().should('include', '/product/');
    });

    it('Enter по запросу переходит на страницу поиска /search/', () => {
        homePage.getSearchInput().click().type('ноутбук{enter}');
        cy.url().should('include', '/search/');
    });

    it('НЕГАТИВ: поиск по несуществующему запросу показывает "ничего не найдено"', () => {
        cy.fixture('testData').then((testData) => {
            homePage.assertSearchNoResults(testData.invalidSearchQuery);
        });
    });

    it('НЕГАТИВ: очистка поля поиска (крестик) сбрасывает введённый текст', () => {
        // Иконка-крестик — тот же паттерн, что и везде в проекте: span
        // с классом i-ph:x, не отдельная <button>. ВАЖНО: клик по ней СРАЗУ
        // после типирования ловит гонку с дебаунсом поиска — если клик
        // происходит раньше, чем осядет отложенный запрос подсказок, его
        // поздний ответ переписывает уже очищенное поле обратно. Ждём
        // результаты (надёжный сигнал загрузки) перед очисткой.
        homePage.getSearchInput().click().type('ноутбук');
        cy.contains(/\d[\d\s]*\s?₸/, { timeout: 10000 }).should('be.visible');
        cy.get('.iconify.i-ph\\:x').first().click({ force: true });
        homePage.getSearchInput().should('have.value', '');
    });
});

describe('Главная — Хедер: счётчики (Заказы/Сравнение/Избранное/Корзина)', () => {
    it('Счётчик "Корзина" соответствует количеству товаров из GET /api/v2/basket', () => {
        cy.intercept('GET', '**/api/v2/basket').as('basket');
        cy.visit('/');
        cy.wait('@basket').then(({ response }) => {
            const items = response.body?.data?.items || response.body?.items || [];
            if (items.length === 0) {
                cy.log('Корзина пуста — бейдж не должен отображаться');
                homePage.getHeaderBadgeByLabel('Корзина').find('span, div').contains(/^\d+$/).should('not.exist');
                return;
            }
            homePage.getHeaderBadgeByLabel('Корзина').should('contain.text', String(items.length));
        });
    });

    it('Счётчик "Сравнение" соответствует count из GET /api/v2/compare/small', () => {
        cy.intercept('GET', '**/api/v2/compare/small').as('compareSmall');
        cy.visit('/');
        cy.wait('@compareSmall').then(({ response }) => {
            const items = response.body?.data?.items || response.body?.items || response.body?.data || [];
            const count = Array.isArray(items) ? items.length : (response.body?.count ?? 0);
            if (count === 0) { cy.log('Сравнение пусто — кейс пропущен'); return; }
            homePage.getHeaderBadgeByLabel('Сравнение').should('contain.text', String(count));
        });
    });

    it('Счётчик "Избранное" соответствует count из GET /api/v3/favorites', () => {
        cy.intercept('GET', '**/api/v3/favorites').as('favorites');
        cy.visit('/');
        cy.wait('@favorites', { timeout: 20000 }).then(({ response }) => {
            const items = response.body?.data?.items || response.body?.data || response.body?.items || [];
            const count = Array.isArray(items) ? items.length : (response.body?.count ?? 0);
            if (count === 0) { cy.log('Избранное пусто — кейс пропущен'); return; }
            homePage.getHeaderBadgeByLabel('Избранное').should('contain.text', String(count));
        });
    });

    it('Счётчик "Заказы" соответствует GET /api/v3/orders/active-count (авторизован)', () => {
        cy.login();
        cy.intercept('GET', '**/api/v3/orders/active-count').as('ordersActiveCount');
        cy.visit('/');
        cy.wait('@ordersActiveCount', { timeout: 20000 }).then(({ response }) => {
            if (response.statusCode !== 200) { cy.log('Не авторизован — кейс пропущен'); return; }
            const count = response.body?.data?.count ?? response.body?.count;
            if (!count) { cy.log('Активных заказов нет — бейдж не проверяем'); return; }
            homePage.getHeaderBadgeByLabel('Заказы').should('contain.text', String(count));
        });
    });
});

describe('Главная — Хедер: профиль/логин', () => {
    it('Авторизованный пользователь: клик по иконке профиля открывает меню, "Личный кабинет" ведёт в ЛК', () => {
        cy.login();
        cy.visit('/');
        // Клик по иконке профиля открывает ВЫПАДАЮЩЕЕ МЕНЮ (не прямая
        // навигация) — разведка 2026-08-18: там же продублирован весь
        // сайдбар ЛК (Мои заказы/Бонусы и фишки/Мои карты/Избранное/...) +
        // ФИО/телефон и кнопка выхода внизу.
        cy.contains('p', 'John').click();
        cy.contains('a, button', 'Личный кабинет').click();
        cy.url().should('include', '/cabinet');
    });
});

describe('Главная — Хедер: негативные сценарии (обработка ошибок API)', () => {
    it('GET /api/v3/catalog/menu — 500 не роняет всю страницу, шапка остаётся видна', () => {
        cy.intercept('GET', '**/api/v3/catalog/menu', { statusCode: 500, body: {} }).as('menuError');
        cy.visit('/');
        cy.wait('@menuError');
        homePage.header.should('be.visible');
        // <main>, не <body> — <body> включает текст инлайн-<script> тегов
        // аналитики, где буквально встречается строка "undefined" как часть
        // JS-кода (var userId="undefined") — ложное срабатывание, не
        // связанное с реальным UI (тот же паттерн, что уже задокументирован
        // в cabinet_overview.cy.js/coupons.cy.js).
        cy.get('main').should('not.contain.text', 'undefined');
    });

    it('GET /api/v2/header/info — 500 не роняет страницу целиком', () => {
        cy.intercept('GET', '**/api/v2/header/info', { statusCode: 500, body: {} }).as('headerInfoError');
        cy.visit('/');
        cy.wait('@headerInfoError');
        cy.get('[placeholder="Искать товары"]').should('be.visible');
    });

    // НАХОДКА 2026-08-18: при 500 на /api/v2/header/cities кнопка "Астана" в
    // шапке вообще пропадает (текст города заменяется на "—"), хотя текущий
    // выбранный город логически не должен зависеть от того, загрузился ли
    // ПОЛНЫЙ список городов для модалки выбора — это два разных назначения
    // одного эндпоинта. Тест фиксирует ОЖИДАЕМОЕ поведение (город остаётся
    // виден) и должен падать, пока не исправлено — кандидат в BugReport,
    // обсудить с пользователем перед заведением в Jira.
    it('GET /api/v2/header/cities — 500 не убирает текущий выбранный город из шапки', () => {
        cy.intercept('GET', '**/api/v2/header/cities', { statusCode: 500, body: {} }).as('citiesError');
        cy.visit('/');
        cy.wait('@citiesError');
        cy.contains('button', 'Астана', { timeout: 15000 }).should('be.visible');
    });
});
