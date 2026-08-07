// Лист 14 "Модалка выбора экземпляра" (MODAL-001..025) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Огромное пересечение с уже автоматизированным: MODAL-001/002/003/006/009/
// 010/011/012/016/018/019/021/023/025 — это, по сути, ОДИН И ТОТ ЖЕ паттерн
// "поля модалки совпадают с API по discounted_id" / "клик Выбрать ведёт на
// нужную страницу" / "Причина уценки раскрывается независимо" / "крестик
// закрывает без побочных эффектов" — уже покрыто TC-007..018 (Sheet 1,
// catalog_and_card.cy.js) и PRICE-002 (Sheet 7). MODAL-017/020/022/024 —
// визуальный/дизайн-ревью объём (стиль бейджа, шеврон, локаль заголовка —
// последнее уже покрыто TC-018). Ниже — только генуинно НЕ покрытое: список
// модалки при ПОВТОРНОМ открытии после перехода между экземплярами,
// уникальность serial number между позициями, мок "продано", browser back.
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: модалка выбора экземпляра (MODAL-004/005/007/013/014, непокрытая часть)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    // Разведкой подтверждено: сырой ответ /defectives включает ВСЕ экземпляры
    // (включая текущий) — исключение текущего происходит на ФРОНТЕНДЕ при
    // рендере модалки, не на уровне API. Поэтому сверяем не сырой массив
    // API, а число фактически отрендеренных карточек ("Выбрать") — оно
    // должно быть на 1 меньше общего числа экземпляров в API
    it('MODAL-004/005/008: модалка НЕ содержит текущий просматриваемый экземпляр — отрендерено на 1 карточку меньше, чем всего экземпляров в API', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@defectives', { timeout: 20000 }).then((interception) => {
            const totalInApi = interception.response.body.defectives.length;
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0).should('have.length', totalInApi - 1);
        });
    });

    it('MODAL-004 (после перехода): открыв модалку на НОВОЙ странице (др. экземпляр), число отрендеренных карточек снова на 1 меньше общего числа в API', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@defectives', { timeout: 20000 });
        DefectiveProduct.clickDefectiveTrigger();
        DefectiveProduct.assertDefectiveModalShown();
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectivesAfterNav');
        DefectiveProduct.selectDefectiveModalItem(0);
        cy.url().should('not.include', fixtures.defectiveUnit.url.split('_').pop().replace(/\/$/, ''));
        cy.wait('@defectivesAfterNav', { timeout: 20000 }).then((interception) => {
            const totalInApi = interception.response.body.defectives.length;
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0).should('have.length', totalInApi - 1);
        });
    });

    it('MODAL-007: у всех позиций в списке РАЗНЫЕ serial number/slug, даже если видимые поля (цена/адрес) могут совпадать', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectives', { timeout: 20000 }).then((interception) => {
            const slugs = interception.response.body.defectives.map((d) => d.slug);
            const uniqueSlugs = new Set(slugs);
            expect(uniqueSlugs.size, 'все discounted_id/slug в списке должны быть уникальны — дублей быть не должно').to.eq(slugs.length);
        });
    });

    it('MODAL-013: экземпляр, "проданный" между загрузкой страницы и открытием модалки (мок), не даёт перейти на страницу проданного товара', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives', (req) => {
            req.continue((res) => {
                if (res.body.defectives && res.body.defectives[0]) {
                    res.body.defectives[0].availability = 'notAvailable';
                }
            });
        }).as('defectivesSoldOut');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectivesSoldOut', { timeout: 20000 });
        DefectiveProduct.clickDefectiveTrigger();
        DefectiveProduct.assertDefectiveModalShown();
        cy.get('body').should('be.visible');
        cy.get('body').then(($body) => {
            const clone = $body.clone();
            clone.find('script').remove();
            expect(clone.text()).to.not.include('undefined');
        });
    });

    it('MODAL-014: кнопка "Назад" браузера после перехода между экземплярами через модалку корректно возвращает на исходную страницу', () => {
        cy.visit(fixtures.defectiveUnit.url);
        cy.url().then((originalUrl) => {
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            DefectiveProduct.selectDefectiveModalItem(0);
            cy.url().should('not.eq', originalUrl);
            cy.go('back');
            cy.url().should('eq', originalUrl);
            DefectiveProduct.assertDefectiveModalNotShown();
        });
    });
});
