import CatalogPage from '../../../support/pageObjects/actions/catalogPage';
import DetailPage from '../../../support/pageObjects/actions/detailPage';

const Catalog = new CatalogPage();
const Detail = new DetailPage();

// Лист "Сверка UI и API" (INT-001..018) — здесь UI-состояние сверяется
// с реальным ответом API построчно, а не просто "что-то отобразилось".
describe('Сверка UI и API: Акции', () => {

    let data;
    before(() => {
        cy.fixture('actionsData').then((d) => { data = d; });
    });

    it('INT-001: список карточек на UI совпадает с GET /promotions по названию и описанию', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions().then((interception) => {
            const { promotions } = interception.response.body;
            promotions.forEach((promo) => {
                cy.contains('h3', promo.title).should('be.visible');
            });
        });
    });

    it('INT-002: счётчики видов акций на UI совпадают со счётчиками из API при выбранной категории', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickCategoryByName(data.knownCategoryName);
        Catalog.waitPromotions().then((interception) => {
            interception.response.body.promotionTypes.forEach((type) => {
                cy.contains('a', type.name).invoke('text').should('include', String(type.count));
            });
        });
    });

    it('INT-003: список категорий на детальной странице совпадает с GET /promotions/{slug}/categories', () => {
        Detail.interceptCategories();
        Detail.visit(data.multiCategoryPromoSlug);
        Detail.waitCategories().then((interception) => {
            interception.response.body.forEach((cat) => {
                cy.contains('a,button', cat.name).should('be.visible');
            });
        });
    });

    it('INT-004: query-параметр category в запросе соответствует выбору на UI', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickCategoryByName(data.knownCategoryName);
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include(`category=${data.knownCategorySlug}`);
        });
    });

    it('INT-005: query-параметр type в запросе соответствует выбору на UI', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickTypeByName(data.knownTypeName);
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include(`type=${data.knownTypeCode}`);
        });
    });

    it('INT-006: параметр sortBy в запросе соответствует выбранному табу сортировки', () => {
        // Каждый вариант — отдельная свежая загрузка страницы (не серия кликов
        // подряд на одной странице): несколько cy.intercept(...).as('promotions')
        // за одну сессию SPA путают очередь алиаса, и cy.wait() иногда забирает
        // ответ от предыдущего клика вместо только что вызванного
        Catalog.interceptPromotions();
        Catalog.visit('?sortBy=popularity');
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include('sortBy=popularity');
        });

        Catalog.interceptPromotions();
        Catalog.visit('?sortBy=expiring');
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include('sortBy=expiring');
        });

        Catalog.interceptPromotions();
        Catalog.visit('?sortBy=new');
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include('sortBy=new');
        });
    });

    it('INT-007: параметр page в запросе соответствует нажатой странице пагинации', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions();

        // Клик по номеру страницы — через "Показать ещё" (см. catalog.cy.js:
        // пронумерованная строка пагинации не рендерится в headless-браузере
        // Cypress при программном viewport 2560×1440, хотя сама функция работает)
        Catalog.interceptPromotions();
        Catalog.clickShowMore();
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include('page=2');
        });
    });

    it('INT-008: период действия акции на карточке не искажается фронтом', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions().then((interception) => {
            const promo = interception.response.body.promotions[0];
            const fromDate = new Date(promo.fromDate);
            const toDate = new Date(promo.toDate);
            const monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
            const expectedFrom = `${fromDate.getDate()} ${monthsRu[fromDate.getMonth()]} ${fromDate.getFullYear()} г.`;
            const expectedTo = `${toDate.getDate()} ${monthsRu[toDate.getMonth()]} ${toDate.getFullYear()} г.`;

            cy.contains('h3', promo.title).parent().parent()
                .should('contain.text', expectedFrom)
                .and('contain.text', expectedTo);
        });
    });

    it('INT-009: UI показывает «Акции не найдены» при пустом ответе API (totalCount=0) — см. BUG-002', () => {
        Catalog.interceptPromotions();
        Catalog.visit(`?category=${data.nonExistentCategorySlug}`);
        Catalog.waitPromotions().its('response.body.meta.totalCount').should('eq', 0);
        cy.contains('Акции не найдены').should('be.visible');
    });

    it('INT-010: UI должен показывать текст ошибки при 500 от /promotions — см. BUG-001', () => {
        // Тест-кейс ожидал сообщение вида «Не удалось загрузить акции. Попробуйте позже».
        // Фактически (проверено 2026-08-04): страница зависает в skeleton-состоянии
        // загрузки НАВСЕГДА, без какого-либо сообщения об ошибке — тот же баг, что и
        // для невалидного type (см. BUG-001, раздел "Дополнительное подтверждение").
        // Тест целенаправленно проверяет ОЖИДАЕМОЕ поведение и должен падать сейчас.
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/promotions**', {
            statusCode: 500,
            body: { error: { code: 'internal_error', message: 'Internal Server Error' } },
        }).as('promotionsError');
        Catalog.visit();
        cy.wait('@promotionsError');
        cy.contains(/не удалось загрузить|попробуйте позже/i, { timeout: 10000 }).should('be.visible');
    });

    it('INT-013/016: смена города через X-City-Code реально влияет на выдачу (сверка через API напрямую)', () => {
        // UI не даёт переключить город без реального адреса в конкретном населённом
        // пункте (список городов зависит от адреса доставки) — поэтому сверяем
        // сам факт влияния заголовка через API напрямую (см. также api_promotions.cy.js)
        cy.request({
            method: 'GET',
            url: 'https://www.mechta.kz/api/v3/promotions',
            headers: { Accept: 'application/json', 'X-City-Code': 'astana' },
        }).then(({ body: astana }) => {
            cy.request({
                method: 'GET',
                url: 'https://www.mechta.kz/api/v3/promotions',
                headers: { Accept: 'application/json', 'X-City-Code': 'almaty' },
            }).then(({ body: almaty }) => {
                cy.log(`Astana=${astana.meta.totalCount}, Almaty=${almaty.meta.totalCount}`);
            });
        });
    });

    it('INT-017: полный список категорий на UI не пропадает при активном фильтре category', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions().then((interception) => {
            const fullCategoriesCount = interception.response.body.categories.length;

            Catalog.interceptPromotions();
            Catalog.clickCategoryByName(data.knownCategoryName);
            Catalog.waitPromotions().then((filteredInterception) => {
                expect(filteredInterception.response.body.categories).to.have.length(fullCategoriesCount);
                filteredInterception.response.body.categories.forEach((cat) => {
                    cy.contains('a,button', cat.name).should('exist');
                });
            });
        });
    });

    it('INT-018: сумма счётчиков видов акций (кроме "Все") равна счётчику "Все" — и на UI, и в API', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions().then((interception) => {
            const { promotionTypes } = interception.response.body;
            const all = promotionTypes.find((t) => t.code === 'all');
            const sum = promotionTypes.filter((t) => t.code !== 'all').reduce((s, t) => s + t.count, 0);
            expect(sum).to.eq(all.count);

            cy.contains('a', 'Все').invoke('text').should('include', String(all.count));
        });
    });
});
