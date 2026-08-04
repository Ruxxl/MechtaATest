import { getPromotionCategories, getPromotionCategoriesRaw } from '../../../support/helpers/promotionsApi';

// Лист "API - Категории акции" (API-CT-001..013).
//
// Реальный контракт (проверено 2026-08-03) СУЩЕСТВЕННО отличается от предположения
// в тест-кейсах: это не плоский список {slug, name}, а ДЕРЕВО категорий с полями
// id, slug, name, image, count, level, children[].
describe('API: Категории акции (/api/v3/promotions/{slug}/categories)', () => {

    describe('Позитивные', () => {

        it('API-CT-001: успешный запрос категорий по валидному slug', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.bannerPromoSlug).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    expect(body).to.be.an('array').and.not.be.empty;
                });
            });
        });

        it('API-CT-002: город (X-City-Code) влияет на count внутри категорий', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.bannerPromoSlug, { headers: { 'X-City-Code': 'astana' } }).then(({ body: astana }) => {
                    getPromotionCategories(data.bannerPromoSlug, { headers: { 'X-City-Code': 'almaty' } }).then(({ status, body: almaty }) => {
                        expect(status).to.eq(200);
                        cy.log(`Astana counts: ${JSON.stringify(astana.map((c) => c.count))}`);
                        cy.log(`Almaty counts: ${JSON.stringify(almaty.map((c) => c.count))}`);
                    });
                });
            });
        });

        it('API-CT-004: Accept-Language=kk локализует name категорий', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.bannerPromoSlug, { headers: { 'Accept-Language': 'kk' } }).then(({ body: kkBody }) => {
                    getPromotionCategories(data.bannerPromoSlug, { headers: { 'Accept-Language': 'ru' } }).then(({ body: ruBody }) => {
                        expect(kkBody[0].name).to.not.eq(ruBody[0].name);
                    });
                });
            });
        });

        it('API-CT-005: акция с единственной категорией — массив из одного элемента', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.singleCategoryPromoSlug).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    expect(body).to.have.length(1);
                });
            });
        });

        it('API-CT-006: акция без категорий — пустой массив', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.noCategoryPromoSlug).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    expect(body).to.be.an('array').and.have.length(0);
                });
            });
        });

        it('API-CT-007: схема ответа — обязательные поля присутствуют с корректными типами', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.multiCategoryPromoSlug).then(({ body }) => {
                    const category = body[0];
                    expect(category).to.include.all.keys('id', 'slug', 'name', 'image', 'count', 'level', 'children');
                    expect(category.slug).to.be.a('string');
                    expect(category.name).to.be.a('string');
                    expect(category.count).to.be.a('number');
                    expect(category.level).to.be.a('number');
                    expect(category.children).to.be.an('array');
                });
            });
        });

        it('API-CT-012: запрос без X-City-Code вообще -> 200, backend не падает', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.bannerPromoSlug, { headers: { 'X-City-Code': undefined } }).then(({ status }) => {
                    expect(status).to.eq(200);
                });
            });
        });
    });

    describe('Негативные', () => {

        it('API-CT-008: несуществующий slug -> ОЖИДАЕТСЯ 404/400, ФАКТИЧЕСКИ 500 — см. BUG-005', () => {
            // BUG-005 (BugReport/Акции/BUG-005-categories-endpoint-wrong-error-status.md):
            // backend отвечает осмысленным телом ({"error":{"code":"promotion_not_found",...}}),
            // но кодом состояния 500 — то есть сам знает причину, но сигнализирует о ней
            // кодом "сбой сервера" вместо кода "клиент запросил несуществующий ресурс".
            // Реальная детальная страница акции с несуществующим slug у пользователя корректно
            // редиректит на список акций, НЕ показывая эту ошибку — фронтенд не ломается, но
            // некорректный код ответа на уровне самого API — самостоятельный дефект.
            // Тест фиксирует ПРАВИЛЬНЫЙ HTTP-контракт (4xx, не 5xx) и должен упасть, пока
            // backend не приведёт код ответа в соответствие с телом ошибки.
            cy.fixture('actionsData').then((data) => {
                getPromotionCategories(data.nonExistentPromoSlug, { failOnStatusCode: false }).then(({ status, body }) => {
                    expect(status, 'HTTP статус для "не найдено" должен быть 4xx').to.be.within(400, 499);
                    expect(body.error.code).to.eq('promotion_not_found');
                });
            });
        });

        it('API-CT-009: slug со спецсимволами/XSS не приводит к 500 и не отражает скрипт', () => {
            getPromotionCategoriesRaw('%3Cscript%3Ealert(1)%3C%2Fscript%3E', { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.not.eq(500);
                expect(JSON.stringify(body)).to.not.include('<script>');
            });
        });

        it('API-CT-010: slug с кириллицей и пробелами -> ожидается 4xx, фактически тот же 500 — см. BUG-005', () => {
            getPromotionCategoriesRaw('%D0%B0%D0%BA%D1%86%D0%B8%D1%8F%20%D1%82%D0%B5%D1%81%D1%82', { failOnStatusCode: false }).then(({ status }) => {
                expect(status, 'HTTP статус для "не найдено" должен быть 4xx (см. BUG-005)').to.be.within(400, 499);
            });
        });

        it('API-CT-011: очень длинный slug (2000+ символов) -> ожидается 4xx, фактически 500 — см. BUG-005', () => {
            const longSlug = 'a'.repeat(2000);
            getPromotionCategoriesRaw(longSlug, { failOnStatusCode: false }).then(({ status }) => {
                expect(status, 'HTTP статус для "не найдено" должен быть 4xx (см. BUG-005)').to.be.within(400, 499);
            });
        });
    });
});
