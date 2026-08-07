// Лист 20 "Кросс-сверка уценочных полей API" (API-DEF2-001..008) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Все тесты — прямые API-запросы (cy.request), без UI: сравнение ответа
// эндпоинта (А) GET /product/{baseSlug}/defectives (список альтернатив) с
// ответом эндпоинта (Б) GET /product/{instanceSlug} (прямой заход на
// экземпляр) для ОДНОГО и того же физического уцененного экземпляра.
//
// НЕ автоматизировано:
// - API-DEF2-006 (координаты магазина на карте) — живой разведкой карты в
//   блоке "Доступно на самовывоз"/"Способ доставки" не найдено вообще,
//   сравнивать не с чем
// - API-DEF2-007 (regression-тест на рассинхрон А/Б через мок) — оба
//   эндпоинта относятся к РАЗНЫМ URL/ресурсам, для валидного мока
//   рассинхрона нужно перехватывать оба одновременно на реальной странице;
//   API-DEF2-001/003 ниже уже покрывают позитивный сценарий "оба
//   эндпоинта согласованы для реальных данных" тем же способом
const API_HEADERS = { 'X-Mechta-Device-Id': 'test123' };

describe('Уценённые товары: кросс-сверка полей между /defectives и прямым /product/{slug} (API-DEF2-001/002/003/004/005/008)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    const baseSlug = () => fixtures.regularWithDefectiveVariants.url.split('/product/')[1].replace(/\/$/, '');
    const instanceSlug = () => fixtures.defectiveUnit.url.split('/product/')[1].replace(/\/$/, '');

    it('API-DEF2-001/003: defectType/componentsState/packageState/prices ИДЕНТИЧНЫ между списком (А) и прямым обращением (Б) для одного экземпляра', () => {
        cy.request({ url: `https://www.mechta.kz/api/v3/product/${baseSlug()}/defectives`, headers: API_HEADERS }).then((listResponse) => {
            const listItem = listResponse.body.defectives.find((d) => d.slug === instanceSlug());
            expect(listItem, 'экземпляр должен присутствовать в списке /defectives').to.exist;
            cy.request({ url: `https://www.mechta.kz/api/v3/product/${instanceSlug()}`, headers: API_HEADERS }).then((directResponse) => {
                const direct = directResponse.body;
                expect(direct.defectiveDetails.defectType).to.eq(listItem.defectType);
                expect(direct.defectiveDetails.componentsState).to.eq(listItem.componentsState);
                expect(direct.defectiveDetails.packageState).to.eq(listItem.packageState);
                expect(direct.prices.basePrice).to.eq(listItem.prices.basePrice);
                expect(direct.prices.finalPrice).to.eq(listItem.prices.finalPrice);
            });
        });
    });

    it('API-DEF2-002: subdivision (адрес/график/остаток) доступен в списке (А); прямой эндпоинт (Б) публично его не отдаёт вовсе — не частичное расхождение полей, а последовательное отсутствие целого объекта', () => {
        cy.request({ url: `https://www.mechta.kz/api/v3/product/${baseSlug()}/defectives`, headers: API_HEADERS }).then((listResponse) => {
            const listItem = listResponse.body.defectives.find((d) => d.slug === instanceSlug());
            expect(listItem.subdivision, 'в списке subdivision должен быть полным объектом').to.include.keys('address', 'schedule', 'stock', 'onlyShopwindow', 'stockProgress', 'latitude', 'longitude');
            cy.request({ url: `https://www.mechta.kz/api/v3/product/${instanceSlug()}`, headers: API_HEADERS }).then((directResponse) => {
                expect(directResponse.body).to.not.have.property('subdivision');
            });
        });
    });

    it('API-DEF2-004: сырой ответ /defectives, запрошенный за БАЗОВЫЙ slug модели, включает и сам текущий экземпляр (фильтрация — забота фронта, см. MODAL-004)', () => {
        cy.request({ url: `https://www.mechta.kz/api/v3/product/${baseSlug()}/defectives`, headers: API_HEADERS }).then((response) => {
            const slugs = response.body.defectives.map((d) => d.slug);
            expect(slugs).to.include(instanceSlug());
        });
    });

    it('API-DEF2-005: baseProductSlug идентичен у РАЗНЫХ экземпляров одной модели, а id/slug — уникальны для каждого (правильное разделение "модель" vs "экземпляр")', () => {
        const siblingSlug = fixtures.defectiveUnitSibling.url.split('/product/')[1].replace(/\/$/, '');
        cy.request({ url: `https://www.mechta.kz/api/v3/product/${instanceSlug()}`, headers: API_HEADERS }).then((first) => {
            cy.request({ url: `https://www.mechta.kz/api/v3/product/${siblingSlug}`, headers: API_HEADERS }).then((second) => {
                expect(first.body.defectiveDetails.baseProductSlug, 'baseProductSlug должен совпадать — это одна и та же модель').to.eq(second.body.defectiveDetails.baseProductSlug);
                expect(first.body.id, 'id экземпляра должен быть УНИКАЛЕН для каждого физического товара, а не общим на модель').to.not.eq(second.body.id);
                expect(first.body.slug).to.not.eq(second.body.slug);
            });
        });
    });

    it('API-DEF2-008: блок "Все характеристики" на странице экземпляра берёт данные из product.mainProperties (общих для модели), а не ищет их внутри defectiveDetails', () => {
        cy.request({ url: `https://www.mechta.kz/api/v3/product/${instanceSlug()}`, headers: API_HEADERS }).then((response) => {
            const { mainProperties, defectiveDetails } = response.body;
            expect(mainProperties, 'mainProperties должен быть непустым массивом общих характеристик').to.be.an('array').and.have.length.greaterThan(0);
            const propertyNames = mainProperties.map((p) => p.name);
            ['Бренд', 'Модель'].forEach((expectedName) => {
                expect(propertyNames, `mainProperties должен содержать "${expectedName}"`).to.include(expectedName);
            });
            expect(defectiveDetails).to.not.have.property('mainProperties');
        });
        cy.visit(fixtures.defectiveUnit.url);
        cy.contains('Все характеристики').should('be.visible');
    });
});
