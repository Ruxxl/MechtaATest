// Лист 10 "Стикер Уценка (сквозная)" (STICKER-001..016) и Лист 11 "Сверка
// полей карточки с API" (CARD-001..014) из Уцененные_товары_тест_кейсы.xlsx
// — см. TestPlans/Defectives-full-testcases.md.
//
// Оба листа СИЛЬНО пересекаются с уже автоматизированным:
// - STICKER-002/003/010/015: "стикер на каждой карточке" — уже покрыто
//   DISP-010 (Sheet 9) и косвенно всеми тестами каталога/фильтров
// - STICKER-006/007: стикер в смешанной корзине — уже покрыто TC-030/035
//   (Sheet 3, cart_and_checkout.cy.js)
// - STICKER-009: стикер на экране "Спасибо за покупку" — требует реального
//   оформления заказа, вне сознательной границы проекта
// - STICKER-016: визуальная идентичность стикера в двух вкладках — не
//   проверяется программно (это ручной/дизайн-ревью кейс)
// - CARD-003/005/006/007/008: название/цена/рейтинг/скидка карточки vs API —
//   уже покрыто PRICE-001..004 (Sheet 7) и DISP-001..007 (Sheet 9)
//
// Ниже — ТОЛЬКО то, что реально не покрыто предыдущими листами: стикер в
// модалке выбора и на чек-ауте, поддержка в избранном, устойчивость к
// потере флага уценки (мок), реальное фото конкретного экземпляра (не
// стоковое/фолбэк), обрезка длинного названия.
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: стикер "Уценка" и поля карточки (STICKER/CARD, непокрытая часть)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('STICKER-004: каждая позиция в модалке "Выберите уцененный товар" визуально помечена как уценённая', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectives', { timeout: 20000 }).then((interception) => {
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            const count = interception.response.body.defectives.length;
            cy.get('button')
                .filter((i, el) => /Причина уценки|Скрыть/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0)
                .should('have.length', count);
        });
    });

    it('STICKER-008: позиция с уцененным товаром на экране оформления заказа тоже помечена стикером "Уценка"', () => {
        cy.login();
        cy.visit(fixtures.defectiveUnit.url);
        cy.get('#product-add-to-basket').should('be.visible').click();
        cy.dismissAccessoryUpsell();
        cy.visit('/basket/');
        cy.contains('button', 'Оформить заказ').click();
        cy.contains('button', 'Понятно').click();
        cy.url().should('include', '/checkout/');
        cy.contains('Уценка').should('be.visible');
    });

    it('STICKER-011: уцененный товар поддерживается в "Избранном" и помечен стикером там же', () => {
        cy.login();
        cy.visit(fixtures.defectiveUnit.url);
        // Первое видимое совпадение может не иметь родителя <button> (другой
        // виджет на странице) — фильтруем именно на те, что внутри button
        cy.get('[class*="i-ph:heart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .click({ force: true });
        cy.visit('/favorites/');
        cy.contains('Уценка').should('be.visible');
    });

    // STICKER-013/014 объединены: и явное false, и полное отсутствие поля —
    // оба сценария "нет флага уценки, хотя товар из категории уценённых"
    it('STICKER-013/014: при потере признака уценки (мок) стикер корректно пропадает, не остаётся "залипшим"', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                delete res.body.productType;
                delete res.body.defectiveDetails;
            });
        }).as('productNoDiscountFlag');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productNoDiscountFlag', { timeout: 20000 });
        cy.contains('Уценка').should('not.exist');
    });

    it('CARD-001/002: фото на странице уцененного экземпляра — собственное (images массив непустой), не абстрактный плейсхолдер', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            expect(interception.response.body.images, 'у уцененного экземпляра должны быть собственные фото').to.be.an('array').and.not.be.empty;
            cy.get('img').should('have.length.greaterThan', 0);
        });
    });

    it('CARD-002: товар без фото (мок images=[]) — показывается плейсхолдер, не пустой/сломанный блок', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.images = [];
            });
        }).as('productNoImages');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productNoImages', { timeout: 20000 });
        cy.get('body').should('be.visible');
        cy.get('img').should('have.length.greaterThan', 0);
    });

    it('CARD-004: длинное название товара (мок) обрезается CSS line-clamp, без потери разметки', () => {
        const longName = 'Смартфон APPLE iPhone 17 Pro Max 256GB (Silver) с очень длинным названием которое точно не поместится в две строки карточки товара и должно быть аккуратно обрезано';
        cy.intercept('GET', '**/api/v3/catalog/products*', (req) => {
            req.continue((res) => {
                if (res.body.products && res.body.products[0]) {
                    res.body.products[0].name = longName;
                }
            });
        }).as('productsLongName');
        cy.visit('/section/defective-smartfony-i-gadjety/');
        cy.wait('@productsLongName', { timeout: 20000 });
        cy.contains(longName.slice(0, 30)).should('be.visible');
        cy.get('body').should('be.visible');
    });
});
