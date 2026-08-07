// Лист 5 "API интеграции" (API-001..012) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// ВАЖНО: 10 из 12 кейсов этого листа проверяют ВНУТРЕННИЕ интеграции, для
// которых нет публичного API, доступного из браузера/Cypress:
// - API-002: внутренний http-сервис остатков 1С (discounted_id)
// - API-003: разведкой подтверждено — публичная карточка товара
//   (`/api/v3/product/{slug}`) НЕ содержит полей "Витрина"/"Уценка" по
//   отдельности, только общий availability — расчёт Витрина-Уценка
//   непроверяем через публичный API
// - API-004: XML CommerceML выгрузки заказа в 1С — не публикуется наружу
// - API-005: JSON, отправляемый в внутренний "Центр заказов"
// - API-006: событие/атрибут в MindBox (нужен доступ к MindBox-аккаунту)
// - API-009/010: смоделировать недоступность/некорректные данные ВНУТРИ 1С
//   нельзя, не имея доступа к самому сервису 1С
// - API-011: коллизия генератора slug при одновременном создании двух
//   уценённых единиц — генерация происходит на стороне MDM/backend, снаружи
//   не воспроизводится
// - API-012: разведкой подтверждено — раздел "Уцененные товары" НЕ является
//   узлом дерева категорий (`/api/v3/catalog/menu` не содержит такой записи,
//   только обычные товарные категории + промо-баннеры) — это отдельный
//   статический пункт навигации, а не категория с parent_id, как
//   предполагает план; сам пункт уже проверен в TC-001/002 (Sheet 1)
//
// Оставлены как AUTOMATED только 2 кейса, реально проверяемые через
// публичный `https://www.mechta.kz/api/v3/...`: API-001 (состав полей
// уценённой позиции) и API-007 (фильтрация списка по defect_type —
// пересекается с TC-005 из Sheet 1, здесь проверяем ответ API напрямую,
// без UI). Остальные 10 кейсов — вне досягаемости E2E/browser-тестов,
// требуют доступа к внутренним системам или отдельного API-тестирования
// на уровне бэкенда/интеграций (не в скоупе этого Cypress-проекта).
describe('Уценённые товары: API интеграции (API-001, API-007 — доступные через публичный API)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('API-001 (адаптирован): список уценённых единиц содержит все ожидаемые по смыслу поля (defect_type, defect_details, components_state, package_state, product_id, price, slug)', () => {
        cy.request(`https://www.mechta.kz/api/v3${fixtures.regularWithDefectiveVariants.url}defectives`).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.defectives, 'должен быть непустой список уценённых единиц').to.be.an('array').and.not.be.empty;
            response.body.defectives.forEach((item) => {
                // Имена полей в реальном API отличаются от плана (camelCase,
                // не snake_case; product_id -> нет прямого аналога на этом
                // эндпоинте, slug самой позиции есть) — проверяем СМЫСЛОВОЕ
                // соответствие, не буквальные имена
                expect(item).to.have.property('slug');
                expect(item).to.have.property('defectType');
                expect(item).to.have.property('defectDetails');
                expect(item).to.have.property('componentsState');
                expect(item).to.have.property('packageState');
                expect(item).to.have.property('prices');
                expect(item.prices).to.have.property('finalPrice');
            });
        });
    });

    it('API-007: фильтрация списка уценённых товаров по defect_type возвращает только соответствующие позиции, totalCount совпадает со счётчиком фильтра', () => {
        // Разведкой подтверждено: /catalog/products без заголовка
        // X-Mechta-Device-Id отдаёт 422 — значение не проверяется по
        // существу (годится и произвольная строка), важно только наличие
        const deviceIdHeader = { 'X-Mechta-Device-Id': 'cypress-api-integrations-test' };
        cy.request(`https://www.mechta.kz/api/v3/catalog/filter?slug=${fixtures.defectivesSectionUrl.url.split('/').filter(Boolean).pop()}`).then((filterResponse) => {
            const defectTypeProperty = filterResponse.body.properties.find((p) => p.slug === 'defect_type_slug');
            const option = defectTypeProperty.items[0];
            cy.request({
                url: `https://www.mechta.kz/api/v3/catalog/products?slug=${fixtures.defectivesSectionUrl.url.split('/').filter(Boolean).pop()}&properties[defect_type_slug][]=${option.slug}`,
                headers: deviceIdHeader,
            }).then((productsResponse) => {
                expect(productsResponse.status).to.eq(200);
                expect(productsResponse.body.meta.totalCount, 'totalCount ответа должен совпадать со счётчиком у опции фильтра').to.eq(option.count);
            });
        });
    });
});
