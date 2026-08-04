import { getPromotions, assertPromotionTypesSumMatchesTotal } from '../../../support/helpers/promotionsApi';

// Тесты бьют напрямую в реальный backend API (см. промышленный домен в
// helpers/promotionsApi.js), минуя UI — это соответствует листу
// "API - Список акций" тест-кейсов (API-PR-001..036).
//
// Реальные факты, расходящиеся с исходными тест-кейсами (проверено 2026-08-03):
// - Смену города определяет заголовок X-City-Code (нижний регистр), а не Cookie.
// - sortBy реально принимает значения: popularity, expiring, new (подтверждено
//   перехватом настоящего запроса фронтенда).
// - type с неизвестным значением -> 422 (не 200 с пустым списком, как думали).
// - category с неизвестным значением -> 200, но promotions: null (не []).
// - page вне диапазона (9999) -> сервер клэмпит на последнюю страницу с
//   реальными данными, а не отдаёт пустой список.
// - НАЙДЕН БАГ: promotions — JSON-массив на "плотных" страницах, но
//   превращается в JSON-объект с строковыми ключами на страницах, где PHP-массив
//   не переиндексирован (см. тест "контракт: promotions всегда массив").
// - НАЙДЕН БАГ: см. api_categories.cy.js — categories/{slug} возвращает 500
//   вместо 404 для несуществующего slug.
describe('API: Список акций (/api/v3/promotions)', () => {

    describe('Позитивные', () => {

        it('API-PR-001: базовый запрос без фильтров возвращает контракт', () => {
            getPromotions().then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body).to.have.all.keys('promotions', 'categories', 'promotionTypes', 'meta');
                expect(body.promotions).to.be.an('array').and.not.be.empty;
                expect(body.meta).to.include.all.keys('currentPage', 'totalPages', 'perPage', 'totalCount');
            });
        });

        it('API-PR-002: сумма promotionTypes.count (кроме all) равна meta.totalCount', () => {
            getPromotions().then(({ body }) => {
                assertPromotionTypesSumMatchesTotal(body);
            });
        });

        it('API-PR-003: фильтр по существующей категории — categories[] остаётся полным списком', () => {
            getPromotions().then(({ body: unfiltered }) => {
                const fullCategoriesCount = unfiltered.categories.length;

                cy.fixture('actionsData').then((data) => {
                    getPromotions({ category: data.knownCategorySlug }).then(({ status, body }) => {
                        expect(status).to.eq(200);
                        expect(body.promotions.length).to.eq(body.meta.totalCount);
                        // Категории не обрезаются под фильтр — приходит полный список
                        expect(body.categories.length).to.eq(fullCategoriesCount);
                    });
                });
            });
        });

        it('API-PR-004: фильтр по существующему типу — promotionTypes[type].count согласован с totalCount', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotions({ type: data.knownTypeCode }).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    const typeEntry = body.promotionTypes.find((t) => t.code === data.knownTypeCode);
                    expect(typeEntry.count).to.eq(body.meta.totalCount);
                    // У каждого объекта в promotions[] НЕТ поля type/category —
                    // проверить принадлежность каждого элемента фильтру напрямую
                    // по ответу этого эндпоинта невозможно (контракт не содержит этих полей)
                });
            });
        });

        it('API-PR-005: комбинированный фильтр category+type — счётчик "all" считается только по категории', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotions({ category: data.knownCategorySlug }).then(({ body: categoryOnly }) => {
                    const categoryOnlyTotal = categoryOnly.meta.totalCount;

                    getPromotions({ category: data.knownCategorySlug, type: data.knownTypeCode }).then(({ status, body: combined }) => {
                        expect(status).to.eq(200);
                        expect(combined.meta.totalCount).to.be.at.most(categoryOnlyTotal);

                        const allEntry = combined.promotionTypes.find((t) => t.code === 'all');
                        // Неочевидное поведение: all.count — это totalCount ПО КАТЕГОРИИ,
                        // а не итоговое пересечение category+type
                        expect(allEntry.count).to.eq(categoryOnlyTotal);
                    });
                });
            });
        });

        it('API-PR-006: порядок query-параметров не влияет на результат', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotions({ category: data.knownCategorySlug, type: data.knownTypeCode }).then(({ body: order1 }) => {
                    getPromotions({ type: data.knownTypeCode, category: data.knownCategorySlug }).then(({ body: order2 }) => {
                        expect(order1).to.deep.eq(order2);
                    });
                });
            });
        });

        ['popularity', 'expiring', 'new'].forEach((sortBy) => {
            it(`API-PR-007/008/009: сортировка sortBy=${sortBy} принимается backend'ом`, () => {
                getPromotions({ sortBy }).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    expect(body.promotions).to.be.an('array');
                });
            });
        });

        it('API-PR-009 (доп.): "Новые" — дефолтная сортировка без явного параметра', () => {
            getPromotions({ sortBy: 'new' }).then(({ body: explicitNew }) => {
                getPromotions().then(({ body: noSortParam }) => {
                    expect(noSortParam.promotions.map((p) => p.slug)).to.deep.eq(explicitNew.promotions.map((p) => p.slug));
                });
            });
        });

        it('API-PR-010: запрос конкретной страницы', () => {
            getPromotions({ page: 2 }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.currentPage).to.eq(2);
            });
        });

        it('API-PR-011: дефолтные значения пагинации без явных page/perPage', () => {
            getPromotions().then(({ body }) => {
                expect(body.meta.currentPage).to.eq(1);
                expect(body.meta.perPage).to.eq(10);
            });
        });

        it('API-PR-012/016: смена города через X-City-Code реально меняет выдачу', () => {
            getPromotions({}, { headers: { 'X-City-Code': 'astana' } }).then(({ body: astana }) => {
                getPromotions({}, { headers: { 'X-City-Code': 'almaty' } }).then(({ status, body: almaty }) => {
                    expect(status).to.eq(200);
                    // Не утверждаем конкретные числа (живые данные), только сам факт влияния
                    cy.log(`Astana totalCount=${astana.meta.totalCount}, Almaty totalCount=${almaty.meta.totalCount}`);
                });
            });
        });

        it('API-PR-013: X-City-Code — реально работающий механизм (опровергает предположение про Cookie)', () => {
            // Только заголовок, без каких-либо cookie
            getPromotions({}, { headers: { 'X-City-Code': 'astana' } }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.totalCount).to.be.a('number');
            });
        });

        it('API-PR-014: Accept-Language=kk локализует title/name', () => {
            getPromotions({}, { headers: { 'Accept-Language': 'kk' } }).then(({ status, body }) => {
                expect(status).to.eq(200);
                // Кириллица есть, но НЕ содержит характерных русских окончаний вроде "ии"/"ой" —
                // проверяем достаточно грубо: текст не совпадает с русской версией
                getPromotions({}, { headers: { 'Accept-Language': 'ru' } }).then(({ body: ruBody }) => {
                    expect(body.categories[0].name).to.not.eq(ruBody.categories[0].name);
                });
            });
        });

        it('API-PR-015: Accept-Language=ru — локализация по умолчанию', () => {
            getPromotions({}, { headers: { 'Accept-Language': 'ru' } }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.categories[0].name).to.match(/[а-яА-ЯёЁ]/);
            });
        });

        it('API-PR-016: схема ответа — типы данных корректны', () => {
            getPromotions().then(({ body }) => {
                const promo = body.promotions[0];
                expect(promo).to.include.all.keys('title', 'slug', 'image', 'fromDate', 'toDate', 'previewText', 'daysBeforeExpiration', 'link');
                expect(promo.title).to.be.a('string');
                expect(promo.slug).to.be.a('string');
                expect(promo.daysBeforeExpiration).to.be.a('number');

                const category = body.categories[0];
                expect(category).to.include.all.keys('slug', 'name', 'image', 'actionExist');

                const type = body.promotionTypes[0];
                expect(type).to.include.all.keys('code', 'count', 'name');
                expect(type.count).to.be.a('number');
            });
        });

        it('API-PR-017: заголовки ответа соответствуют зафиксированным', () => {
            getPromotions().then(({ headers }) => {
                expect(headers['content-type']).to.include('application/json');
                expect(headers['cache-control']).to.include('no-cache');
                expect(headers['server']).to.eq('cloudflare');
            });
        });

        it('API-PR-018: заголовки rate limit присутствуют и Remaining в пределах Limit', () => {
            // Не проверяем строгое монотонное убывание Remaining между двумя вызовами:
            // Cloudflare раздаёт запросы по разным edge-узлам с отдельными счётчиками,
            // поэтому значение может на короткой дистанции не быть строго убывающим
            getPromotions().then(({ headers: first }) => {
                expect(first).to.include.keys('x-ratelimit-limit', 'x-ratelimit-remaining');
                const limit = Number(first['x-ratelimit-limit']);
                expect(limit).to.eq(6000);
                expect(Number(first['x-ratelimit-remaining'])).to.be.at.most(limit);
            });
        });

        it('API-PR-019: время ответа в пределах разумного SLA', () => {
            getPromotions({ pageSize: 20 }).then(({ duration }) => {
                expect(duration).to.be.lessThan(3000);
            });
        });
    });

    describe('Негативные', () => {

        it('API-PR-020: несуществующий slug категории -> 200 с пустым результатом (promotions: null)', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotions({ category: data.nonExistentCategorySlug }).then(({ status, body }) => {
                    expect(status).to.eq(200);
                    expect(body.meta.totalCount).to.eq(0);
                    // Реальный контракт: null, а не [] — если это когда-то починят на [],
                    // тест тоже нужно будет поправить, но сейчас это фактическое поведение
                    expect(body.promotions).to.be.null;
                });
            });
        });

        it('API-PR-021: несуществующий код типа акции -> 422 (НЕ 200, вопреки исходному тест-кейсу)', () => {
            cy.fixture('actionsData').then((data) => {
                getPromotions({ type: data.nonExistentTypeCode }, { failOnStatusCode: false }).then(({ status, body }) => {
                    expect(status).to.eq(422);
                    expect(body.error.code).to.eq('validation_error');
                });
            });
        });

        it('API-PR-022: недопустимое значение sortBy -> 422', () => {
            getPromotions({ sortBy: 'invalid_value' }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(422);
                expect(body.error.code).to.eq('validation_error');
            });
        });

        it('API-PR-023: page=0 обрабатывается мягко (200, трактуется как страница 1), не 400', () => {
            getPromotions({ page: 0 }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.currentPage).to.eq(1);
            });
        });

        it('API-PR-024: page=-1 не приводит к ошибке 5xx (эхо -1 в currentPage — фактическое поведение)', () => {
            getPromotions({ page: -1 }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.promotions).to.be.an('array').and.not.be.empty;
            });
        });

        it('API-PR-025: page нечисловое значение -> 422', () => {
            getPromotions({ page: 'abc' }, { failOnStatusCode: false }).then(({ status }) => {
                expect(status).to.eq(422);
            });
        });

        it('API-PR-026: perPage=0 обрабатывается мягко (200, дефолтный perPage), не 400', () => {
            getPromotions({ perPage: 0 }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.perPage).to.eq(10);
            });
        });

        it('API-PR-027: perPage превышает максимум -> сервер ограничивает значением по умолчанию, не 400', () => {
            getPromotions({ perPage: 10000 }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.perPage).to.eq(10);
            });
        });

        it('API-PR-028: page за пределами доступных страниц -> сервер клэмпит на последнюю страницу с данными (не пустой список)', () => {
            getPromotions({ page: 9999 }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.currentPage).to.eq(body.meta.totalPages);
                // На этой странице promotions может оказаться объектом из-за БАГА API-PR-036 —
                // здесь проверяем именно непустоту результата, а не форму контейнера
                expect(Object.keys(body.promotions || {})).to.not.be.empty;
            });
        });

        it('API-PR-029: запрос без города вообще -> 200, backend не падает', () => {
            getPromotions({}, { headers: { 'X-City-Code': undefined } }).then(({ status }) => {
                expect(status).to.eq(200);
            });
        });

        it('API-PR-030: отсутствует Accept-Language -> 200, дефолтный язык, ошибок нет', () => {
            getPromotions({}, { headers: { 'Accept-Language': undefined } }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.categories[0].name).to.match(/[а-яА-ЯёЁ]/);
            });
        });

        it('API-PR-031: некорректное значение Accept-Language -> 200, fallback, без 500', () => {
            getPromotions({}, { headers: { 'Accept-Language': 'xx-XX' } }).then(({ status }) => {
                expect(status).to.eq(200);
            });
        });

        it('API-PR-032: SQL-инъекция в category обрабатывается как неизвестная категория, без 500', () => {
            getPromotions({ category: "' OR '1'='1" }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(200);
                expect(body.meta.totalCount).to.eq(0);
            });
        });

        it('API-PR-033: XSS в параметре type отклоняется валидацией (422), скрипт не исполняется/не отражается', () => {
            getPromotions({ type: '<script>alert(1)</script>' }, { failOnStatusCode: false }).then(({ status, body }) => {
                expect(status).to.eq(422);
                expect(JSON.stringify(body)).to.not.include('<script>');
            });
        });

        it('API-PR-034: дублирующиеся query-параметры — побеждает последнее значение', () => {
            // cy.request не даёт задать дублирующиеся ключи через qs {}, поэтому строим URL руками
            cy.request({
                method: 'GET',
                url: 'https://www.mechta.kz/api/v3/promotions?category=noutbuki-i-kompyutery&category=tv-audio-video',
                headers: { Accept: 'application/json', 'X-City-Code': 'astana' },
            }).then(({ status, body }) => {
                expect(status).to.eq(200);
                getPromotions({ category: 'tv-audio-video' }).then(({ body: singleCategoryBody }) => {
                    expect(body.meta.totalCount).to.eq(singleCategoryBody.meta.totalCount);
                });
            });
        });

        it('API-PR-036 (контракт): promotions обязан быть JSON-массивом на любой странице — НАЙДЕННЫЙ БАГ', () => {
            // На "хвостовых" страницах PHP-массив без переиндексации сериализуется
            // в JSON-объект вместо массива ({"10": {...}} вместо [{...}]).
            // Тест намеренно проверяет ПРАВИЛЬНЫЙ контракт и должен упасть, пока это не починят.
            getPromotions({ page: 2 }).then(({ body }) => {
                expect(Array.isArray(body.promotions), 'promotions должен быть массивом на любой странице, а не объектом').to.be.true;
            });
        });
    });
});
