// Лист 13 "Страница товара — функционал" (PDP-001..018) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// НЕ автоматизировано:
// - PDP-002/003/010/011/012/015: требуют разведки "зафиксировать фактическое
//   поведение" без чёткого ожидаемого результата в плане — вне текущего
//   объёма сессии, кандидаты на ручное исследование
// - PDP-007/008 (селектор памяти/цвета меняет доступность "Уцененный N"):
//   пересекается с Sheet 18 "Виджеты состояние-цвет-память" — тестируем там
// - PDP-014: конкретный пример расхождения (8 vs 2 отзыва) из плана — это
//   зафиксированный СТАРЫЙ снимок, не обязательно воспроизводимый сейчас;
//   общий принцип "число отзывов на карточке == на странице товара" зависит
//   от того, совпадают ли поля reviewsCount на обоих эндпоинтах для ТЕКУЩИХ
//   данных — не гадаем, пропускаем без живого подтверждения расхождения
// - PDP-018: требует реальной продажи товара в момент оформления — вне
//   границы проекта (не создаём реальные заказы)
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: страница товара — функционал (PDP-001..018, представительный набор)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('PDP-001: бейдж "Выгода X ₸" точно равен basePrice - finalPrice из API', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { basePrice, finalPrice } = interception.response.body.prices;
            const expectedBenefit = basePrice - finalPrice;
            cy.contains(new RegExp(String(expectedBenefit).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'))).should('be.visible');
        });
    });

    it('PDP-005: выбор другого экземпляра в модалке со страницы товара переключает цену/адрес/URL на выбранный', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@defectives', { timeout: 20000 }).then((interception) => {
            const target = interception.response.body.defectives[0];
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            DefectiveProduct.selectDefectiveModalItem(0);
            cy.url().should('include', target.slug);
        });
    });

    it('PDP-006: выбранный экземпляр сохраняется после перезагрузки страницы (через slug в URL)', () => {
        cy.visit(fixtures.defectiveUnitSibling.url);
        cy.url().then((urlBefore) => {
            cy.reload();
            cy.url().should('eq', urlBefore);
            cy.contains('Уценка').should('be.visible');
        });
    });

    it('PDP-009: "Купить сейчас" на уцен. товаре ведёт к оформлению с тем же предупреждением, что и через корзину', () => {
        cy.login();
        cy.visit(fixtures.defectiveUnit.url);
        cy.contains('button', 'Купить сейчас').click();
        cy.contains('button', 'Понятно').click();
        cy.url().should('include', '/checkout/');
    });

    it('PDP-013: иконки "Сравнение"/"Избранное" на самой странице товара работают так же, как на карточке в каталоге (см. Sheet 12)', () => {
        cy.login();
        cy.visit(fixtures.defectiveUnit.url);
        cy.get('[class*="i-ph:heart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .click({ force: true });
        cy.visit('/favorites/');
        cy.contains('Уценка').should('be.visible');
    });

    it('PDP-017: счётчик "Уцененный N" на триггере соответствует фактическому числу позиций в раскрытой модалке (мок усечённого списка)', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives', (req) => {
            req.continue((res) => {
                res.body.defectives = res.body.defectives.slice(0, 2);
            });
        }).as('defectivesMismatch');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectivesMismatch', { timeout: 20000 }).then((interception) => {
            const actualCount = interception.response.body.defectives.length;
            cy.contains(new RegExp(`Уцененный ${actualCount}\\b`)).should('be.visible');
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0).should('have.length', actualCount);
        });
    });
});
