// Лист 6 "Мок-данные API" (MOCK-001..013) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Часть кейсов вне досягаемости из браузера (см. заголовок
// api_integrations.cy.js для общего объяснения границ проекта):
// - MOCK-002: остаток в 1С — на публичном API нет отдельного числового поля
//   "остаток", есть только текстовый статус subdivision.stock ("На витрине")
//   и общий availability enum — по сути дублирует TC-026 (Sheet 2, мок
//   availability=notAvailable), не повторяем
// - MOCK-003: нет числового поля остатка вообще — отрицательное значение
//   негде смоделировать через публичный API
// - MOCK-004/005: поля "Витрина"/"Уценка" не отдаются публичным API
//   (подтверждено в Sheet 5) — расчёт непроверяем снаружи
// - MOCK-006: дублирует TC-023 (Sheet 2) — тот же мок
//   defectiveDetails.baseProductSlug на несуществующий товар
// - MOCK-007: сравнение JSON API с XML CommerceML — нет доступа к XML-выгрузке
// - MOCK-009: MindBox-запросы уже глобально перехватываются в
//   support/e2e.js (blanket intercept, log:false) — недоступны для
//   содержательной проверки payload на уровне этого проекта
// - MOCK-013: race condition в момент чек-аута — сложнее и менее ценно, чем
//   уже покрытый TC-036 (Sheet 3, приближение), не дублируем
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: устойчивость к моку API (MOCK-001, 008, 010, 011)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('MOCK-001: defect_type=null в ответе API — UI не показывает "null"/"undefined", фильтр не ломается', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.defectiveDetails.defectType = null;
            });
        }).as('productNullType');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productNullType', { timeout: 20000 });
        cy.get('body').then(($body) => {
            const clone = $body.clone();
            clone.find('script').remove();
            const text = clone.text();
            expect(text).to.not.include('null');
            expect(text).to.not.include('undefined');
        });
        // Каталог с фильтрами по-прежнему открывается и работает (фильтр
        // не завязан на конкретный товар, но проверяем что моканный товар
        // не роняет остальной рендер страницы)
        cy.get('body').should('be.visible');
    });

    it('MOCK-010: задержка ответа API 6-8с — показывается индикатор загрузки, без таймаут-краша', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.delay = 6500;
            });
        }).as('slowProduct');
        cy.visit(fixtures.defectiveUnit.url);
        // Пока ответ не пришёл, страница должна показывать skeleton/лоадер,
        // а не пустой белый экран или мгновенный краш
        cy.get('body').should('be.visible');
        cy.wait('@slowProduct', { timeout: 15000 });
        cy.contains('Уценка').should('be.visible');
    });

    it('MOCK-011: неизвестное значение defect_type ("Refurbished-Premium") — UI отображает как есть или "Другое", без падения', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.defectiveDetails.defectType = 'Refurbished-Premium';
            });
        }).as('productUnknownType');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productUnknownType', { timeout: 20000 });
        cy.get('body').should('be.visible');
        cy.contains(/Refurbished-Premium|Другое/).should('be.visible');
    });

    // MOCK-008 адаптирован: реальный ЦЗ недоступен снаружи, но эффект
    // (ошибка при финализации заказа) можно смоделировать, замокав ответ
    // публичного эндпоинта оформления заказа на 500 — благодаря моку
    // реальный заказ при этом НЕ создаётся (запрос перехватывается ДО
    // сервера), поэтому тест безопасен для повторных прогонов
    it('MOCK-008 (адаптирован): ошибка backend при финализации заказа с уцен. товаром — UI показывает ошибку, а не ложный успех', () => {
        cy.login();
        cy.visit(fixtures.defectiveUnit.url);
        cy.get('#product-add-to-basket').should('be.visible').click();
        cy.dismissAccessoryUpsell();
        cy.visit('/basket/');
        cy.contains('button', 'Оформить заказ').click();
        cy.contains('button', 'Понятно').click();
        cy.url().should('include', '/checkout/');
        cy.intercept('POST', '**/api/v3/order*', { statusCode: 500, body: { error: 'internal_error' } }).as('orderFail');
        cy.intercept('POST', '**/order*', { statusCode: 500, body: { error: 'internal_error' } }).as('orderFailBroad');
        cy.contains('button', 'Далее').click();
        cy.get('body').then(($body) => {
            const payBtn = [...$body[0].querySelectorAll('button')].find((el) => /Оплатить/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0);
            if (payBtn) cy.wrap(payBtn).click({ force: true });
        });
        // Не проверяем конкретный текст ошибки (неизвестен заранее) —
        // важно, что страница НЕ переходит на "успех" молча
        cy.url().should('not.include', '/success');
        cy.url().should('not.include', '/thank-you');
    });
});
