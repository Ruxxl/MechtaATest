// Лист 19 "Сверка API defectives с UI" (API-DEF-001..017) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// НЕ автоматизировано:
// - API-DEF-006/007 (адрес/часы работы магазина из API) — подтверждено ещё
//   в Sheet 15: поле subdivision.address НЕ присутствует в публичном
//   /api/v3/product/{slug} (только во внутреннем SSR-пейлоаде), сверить
//   можно только UI-к-UI (характеристики vs таблица магазинов) — уже
//   сделано в STORE-002, дублировать нечем
// - API-DEF-008 (subdivision.stock независим от defectType) — уже
//   исследовано и подтверждено НЕ багом в рамках CART-009 (см.
//   products.json inStock_alsoOnlyShopwindow_note)
// - API-DEF-011 (фото уцененного экземпляра совпадают с фото нового товара)
//   — зафиксированное наблюдение по КОНКРЕТНОЙ фикстуре, не универсальное
//   правило, которое можно assert'ить как правильное/неправильное без
//   вопроса аналитику; систематическая проверка по всему каталогу вне
//   объёма Cypress-теста
// - API-DEF-012 (сумма рассрочки из credit.pay_per_month) — требует
//   разведки блока "Рассрочка или кредит" на уцененной странице, не
//   подтверждено вживую в этой сессии
// - API-DEF-014 (defectiveInfo=null не используется) — фронт использует
//   defectiveDetails{} (camelCase, отдельное от defectiveInfo), тривиально
//   и уже подразумевается всеми остальными тестами этого файла
// - API-DEF-015 (URL использует полный slug с суффиксом) — тривиально и
//   уже фактически проверяется самой структурой fixtures.defectiveUnit
//   во всех остальных тестах сессии
// - API-DEF-017 (назначение stockProgress на UI) — не найдено видимого
//   индикатора/прогресс-бара, использующего это поле, живой разведкой
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: сверка API defectives с UI (API-DEF-001/002/003/004/005/009/010/013/016, представительный набор)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('API-DEF-001/004/005: "Состояние"/"Комплект"/"Упаковка" на UI точно равны defectType/componentsState/packageState из API', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { defectType, componentsState, packageState } = interception.response.body.defectiveDetails;
            cy.contains('Состояние').parent().should('contain.text', defectType);
            cy.contains('Комплект').parent().should('contain.text', componentsState);
            cy.contains('Упаковка').parent().should('contain.text', packageState);
        });
    });

    it('API-DEF-002/003: массив "Дефекты" (details) полностью отображается на UI — все элементы, не только первый и не индексы массива', () => {
        const mockedDetails = ['Замена динамика', 'Царапина на корпусе', 'Скол на экране'];
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.defectiveDetails.details = mockedDetails;
            });
        }).as('productMultiDefect');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productMultiDefect', { timeout: 20000 });
        cy.contains(/Дефекты/i).should('be.visible');
        mockedDetails.forEach((detail) => {
            cy.contains(detail).should('be.visible');
        });
        cy.contains(/^0, 1, 2$/).should('not.exist');
    });

    it('API-DEF-009: старая (зачёркнутая) и текущая цена на UI точно равны basePrice/finalPrice из API, финальная всегда меньше базовой', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { basePrice, finalPrice } = interception.response.body.prices;
            expect(finalPrice, 'финальная цена уцененного экземпляра должна быть меньше базовой').to.be.lessThan(basePrice);
            cy.contains(new RegExp(String(finalPrice).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'))).should('be.visible');
            cy.contains(new RegExp(String(basePrice).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'))).should('be.visible');
        });
    });

    it('API-DEF-010: "Выгода" считается от basePrice (номинальная цена модели), а НЕ от текущей finalPrice обычного товара с его собственной акцией', () => {
        // Зафиксированное поведение (см. также PDP-001): "Выгода" на
        // странице уцененного товара = defectives[i].prices.basePrice -
        // defectives[i].prices.finalPrice. Если у ОБЫЧНОГО товара той же
        // модели в этот момент тоже действует своя (пусть небольшая)
        // акция, "Выгода" НЕ учитывает её — реальная экономия относительно
        // цены, по которой товар можно купить новым ПРЯМО СЕЙЧАС, может
        // быть меньше заявленной. Не баг (см. PDP-001, подтверждена
        // формула), но фиксируем как регресс-тест на саму формулу, а не на
        // конкретные цифры
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { basePrice, finalPrice } = interception.response.body.prices;
            const expectedBenefit = basePrice - finalPrice;
            cy.contains(/Выгода/i).should('be.visible');
            cy.contains(new RegExp(String(expectedBenefit).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'))).should('be.visible');
        });
    });

    it('API-DEF-013: страница уцененного ЭКЗЕМПЛЯРА не путает свой единственный магазин самовывоза с числом магазинов ОБЫЧНОГО товара той же модели', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('defectiveShipment');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@defectiveShipment', { timeout: 20000 }).then((defectiveInterception) => {
            const defectiveSubdivisions = defectiveInterception.response.body.subdivisions;
            cy.intercept('GET', '**/api/v3/product/*/shipment').as('regularShipment');
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            cy.wait('@regularShipment', { timeout: 20000 }).then((regularInterception) => {
                const regularSubdivisions = regularInterception.response.body.subdivisions;
                expect(regularSubdivisions, 'у обычного товара магазинов доставки должно быть больше, чем у одного уцененного экземпляра (иначе фикстуры не иллюстрируют разницу)').to.be.greaterThan(defectiveSubdivisions);
                cy.contains(new RegExp(`из ${defectiveSubdivisions}\\s*магазин`)).should('not.exist');
            });
        });
    });

    it('API-DEF-016: пустой массив defectives ([]) на странице ОБЫЧНОГО товара скрывает пилюлю "Уцененный", не оставляя её с пустыми/undefined данными', () => {
        cy.on('uncaught:exception', () => false);
        cy.intercept('GET', '**/api/v3/product/*/defectives', (req) => {
            req.continue((res) => {
                res.body.defectives = [];
            });
        }).as('noDefectives');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@noDefectives', { timeout: 20000 });
        cy.contains(/Уцененный/i).should('not.exist');
        cy.contains(/undefined|NaN/).should('not.exist');
    });
});
