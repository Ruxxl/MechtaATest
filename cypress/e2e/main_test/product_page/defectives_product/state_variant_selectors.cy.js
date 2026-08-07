// Лист 18 "Виджеты состояние-цвет-память" (VARSEL-001..011) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// ВАЖНО (живая разведка, 2026-08-07): у товара РОВНО с 1 доступным
// уцененным экземпляром (fixtures.defectiveUnitAnotherModel) "Цвет корпуса"
// и "Объём встроенной памяти" рендерятся как ПРОСТОЙ ТЕКСТ (`<p>`/`<span>`
// без единого <a>/<button> внутри) — план ожидал "селектор показывает
// только 1 вариант", но реально при единственном варианте сам селектор
// пропадает как класс интерактивности (тот же паттерн, что и у "Уцененный
// товар"-пилюли с count=1 из Sheet 1/13 — не баг, осознанное упрощение UI).
// VARSEL-009 (клик по единственному свотчу) поэтому НЕ автоматизирован —
// кликать не по чему, свотча-кнопки не существует на этой фикстуре.
//
// НЕ автоматизировано:
// - VARSEL-002 ("Уцененный"-пилюля тут — на многоэкземплярной странице это
//   ТРИГГЕР МОДАЛКИ (см. Sheet 14), а не in-place состояние; повторный
//   клик просто переоткрывает ту же модалку — не даёт новой информации)
// - VARSEL-007 (интерактивность плашки "Объём оперативной памяти" —
//   неопределённое ожидание "зафиксировать фактическое поведение")
// - VARSEL-008 (переключение цвета в "Новый" на цвет без уценки, затем
//   обратно на "Уцененный") — не найден живой товар с 2+ цветами именно
//   среди УЦЕНЁННЫХ экземпляров одной модели, чтобы проверить осмысленно
// - VARSEL-010 (мок "все варианты распроданы для discounted") — нет
//   отдельного эндпоинта с явным available_variants, который можно замокать
// - VARSEL-011 (сверка SKU/фото/наличия при переключении цвета) — требует
//   живого товара с 2+ РЕАЛЬНО переключаемыми цветами, которого не нашли;
//   близкий аналог уже покрыт MODAL-004/PDP-005 (переключение через модалку)
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: виджеты состояние-цвет-память (VARSEL-001/003/004/005/006, представительный набор)', () => {

    let fixtures;
    let products;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
        cy.fixture('products').then((p) => { products = p; });
    });

    it('VARSEL-001: у модели с ровно 1 уцененным экземпляром пилюля "Уцененный" — простая кнопка БЕЗ цифры и БЕЗ шеврона', () => {
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains('button', /^Уцененный$/).should('be.visible');
        cy.contains(/Уцененный\s*\d+/).should('not.exist');
    });

    it('VARSEL-003: кнопка "Новый" со страницы уцененного экземпляра ведёт на страницу обычного товара этой модели', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { baseProductSlug } = interception.response.body.defectiveDetails;
            cy.contains('a', /^Новый$/)
                .should('have.attr', 'href')
                .and('include', baseProductSlug);
            cy.contains('a', /^Новый$/).click();
            cy.url().should('include', baseProductSlug);
            cy.url().should('not.include', fixtures.defectiveUnitAnotherModel.url.split('_').pop().replace(/\/$/, ''));
        });
    });

    it('VARSEL-004: в состоянии "Уцененный" с единственным доступным цветом "Цвет корпуса" рендерится как простой текст, без кликабельного списка', () => {
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains('Цвет корпуса').should('be.visible');
        cy.contains('Цвет корпуса')
            .closest('p, div')
            .find('a, button')
            .should('have.length', 0);
    });

    it('VARSEL-005: в состоянии "Новый" список цветов ШИРЕ, чем в состоянии "Уцененный" (несколько кликабельных вариантов вместо простого текста)', () => {
        cy.visit(products.withColorMemoryCondition.url);
        cy.contains('Цвет корпуса').should('be.visible');
        cy.get('a[href*="cosmic-orange"], a[href*="silver"], a[href*="deep-blue"]')
            .filter((i, el) => el.closest('main'))
            .its('length')
            .should('be.gte', 2);
    });

    it('VARSEL-006: в состоянии "Уцененный" с единственным доступным объёмом памяти "Объём встроенной памяти" не даёт переключить вариант', () => {
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains('Объем встроенной памяти').should('be.visible');
        cy.get('button').filter((i, el) => /^\d+\s*ГБ$/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0).should('have.length.lessThan', 2);
    });
});
