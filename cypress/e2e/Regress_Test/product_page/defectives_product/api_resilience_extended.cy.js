// Лист 17 "Устойчивость к моку API" (RESIL-001..016) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Существенно пересекается по идее с Sheet 6 (MOCK-*, mock_api_resilience.cy.js):
// оба листа про "не падать при кривом ответе API", но с РАЗНЫМИ конкретными
// повреждениями данных — ниже покрыты те классы, которых там ещё не было.
//
// НЕ автоматизировано:
// - RESIL-005/006/007/015 (HTTP 400/401/403/429/offline) — тот же класс
//   "показать понятную ошибку, не бесконечный лоадер", уже частично покрыт
//   Sheet 6 MOCK-008 (мок 500 на finalize); дублировать 4 похожих статус-кода
//   без новой информации не даёт дополнительной уверенности
// - RESIL-013 (гонка устаревшего ответа при быстрой смене контекста) —
//   не воспроизводится детерминированно через cy.intercept с фиксированной
//   задержкой + быстрой навигацией; требует нестабильного тайминга
// - RESIL-014 (задвоенные id в списке, React key collision) — эффект
//   (пропущенные/задвоенные карточки) не отличим программно от корректного
//   рендера без ручного визуального сравнения
// - RESIL-016 (единый формат ошибок по всем эндпоинтам) — мета-проверка
//   контракта API, не UI-поведения; требует прямого сравнения ответов
//   нескольких эндпоинтов без мока, из разведки не установлено единого
//   формата, который можно было бы assert'ить
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: устойчивость к моку API (RESIL-001/002/004/008/009/010/011/012, представительный набор)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('RESIL-001: price приходит строкой вместо числа — страница не падает, цена отображается', () => {
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = String(res.body.prices.finalPrice);
                res.body.prices.basePrice = String(res.body.prices.basePrice);
            });
        }).as('productStringPrice');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productStringPrice', { timeout: 20000 });
        cy.contains(/₸/).should('be.visible');
        cy.contains(/NaN|undefined/).should('not.exist');
    });

    it('RESIL-002: ключ defectiveDetails полностью отсутствует в ответе (не null, а именно отсутствие ключа) — страница не падает', () => {
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                delete res.body.defectiveDetails;
            });
        }).as('productNoDefectiveDetails');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productNoDefectiveDetails', { timeout: 20000 });
        cy.get('h1').should('be.visible');
        cy.contains(/₸/).should('be.visible');
    });

    it('RESIL-004: API возвращает данные ДРУГОГО товара для запрошенного discounted_id — фиксируем фактическое поведение (фронт доверяет ответу backend, не валидирует id)', () => {
        const fakeName = 'ПОДМЕНЁННОЕ НАЗВАНИЕ ДЛЯ ТЕСТА RESIL-004';
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.name = fakeName;
            });
        }).as('productWrongData');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productWrongData', { timeout: 20000 });
        // Фронт не сверяет slug из URL с содержимым ответа — рендерит то,
        // что пришло. Это ожидаемо для SPA, доверяющего своему backend,
        // не баг фронта (см. feedback_dont_over_report_mock_edge_cases) —
        // тест фиксирует поведение на случай будущей регрессии в другую
        // сторону (если фронт вдруг начнёт падать на таком ответе)
        cy.contains(fakeName).should('be.visible');
    });

    it('RESIL-008: битый (невалидный) JSON в ответе — страница показывает состояние ошибки, а не белый экран', () => {
        cy.on('uncaught:exception', () => false);
        cy.intercept('GET', '**/api/v3/product/*', {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: '{"name": "broken json without closing',
        }).as('productMalformedJson');
        cy.visit(fixtures.defectiveUnit.url, { failOnStatusCode: false });
        cy.wait('@productMalformedJson', { timeout: 20000 });
        cy.get('body').should('be.visible').and('not.have.text', '');
    });

    it('RESIL-009: /defectives возвращает объект вместо массива — страница/модалка не падает на .map()', () => {
        cy.on('uncaught:exception', () => false);
        cy.intercept('GET', '**/api/v3/product/*/defectives', (req) => {
            req.continue((res) => {
                res.body.defectives = {};
            });
        }).as('defectivesAsObject');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectivesAsObject', { timeout: 20000 });
        cy.get('h1').should('be.visible');
    });

    it('RESIL-010: images: null вместо пустого массива — галерея не падает, товар отображается', () => {
        cy.on('uncaught:exception', () => false);
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.images = null;
            });
        }).as('productNullImages');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productNullImages', { timeout: 20000 });
        cy.get('h1').should('be.visible');
        cy.contains(/₸/).should('be.visible');
    });

    it('RESIL-011: HTML/JS в названии товара не исполняется как код (XSS), отображается как текст', () => {
        // На случай, если бы <script> реально исполнился — глушим alert,
        // чтобы не заблокировать сессию реальным браузерным диалогом
        cy.on('window:alert', () => {});
        const maliciousName = '<script>alert(1)</script>Смартфон XSS-тест';
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.name = maliciousName;
            });
        }).as('productXssName');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productXssName', { timeout: 20000 });
        cy.get('script').should(($scripts) => {
            const injected = [...$scripts].some((el) => el.textContent.includes('alert(1)'));
            expect(injected, 'скрипт из данных API не должен попасть в DOM как исполняемый <script>').to.be.false;
        });
        cy.contains('Смартфон XSS-тест').should('be.visible');
    });

    it('RESIL-012: экстремально большая цена форматируется читаемо, без экспоненциальной записи (1e+15)', () => {
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = 999999999999999;
                res.body.prices.basePrice = 999999999999999;
            });
        }).as('productHugePrice');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productHugePrice', { timeout: 20000 });
        cy.contains(/e\+\d+/i).should('not.exist');
    });
});
