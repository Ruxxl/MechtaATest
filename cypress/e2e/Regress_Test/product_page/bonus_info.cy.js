// TC-BONUS-01..03 из Mechta_ProductPage_TestCases.xlsx: подсказка по бонусам/фишкам.
// Разведка 2026-08-05: реализация отличается от формулировки плана —
// - Триггер — КЛИК по строке "+N бонусов, +N фишек" (кликабельная <section>), а не
//   наведение курсора на отдельную иконку "?" (такой иконки на странице нет вообще).
// - Открывшийся [role="dialog"] с заголовком "Программа лояльности" содержит текст
//   про оба числа, НО внутри НЕТ ссылки "Подробнее" — только безымянная кнопка
//   закрытия (крестик). TC-BONUS-02 (переход по ссылке) и TC-BONUS-03 (ошибка
//   недоступного роута) описывают функциональность, которой на сайте физически нет —
//   не реализуются буквально, см. "Что НЕ было оформлено как баг" в README области.
// - Числа сверяются с GET /api/v3/product/{slug}/offers (bonuses, chips) — тем же
//   источником, что уже использует check_product_fishki().
import productPage from '../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: подсказка по бонусам/фишкам (TC-BONUS-01)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.onlyShopwindow.url; });
    });

    it('TC-BONUS-01: клик по строке бонусов открывает подсказку, числа совпадают с /offers', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        ProductPage.assertBonusInfoModalMatchesApi();
    });

    it('НЕСТАНДАРТНЫЙ: подсказка закрывается по Esc', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        ProductPage.openBonusInfoModal();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('body').type('{esc}');
        cy.get('[role="dialog"]').should('not.exist');
    });

    it('НЕГАТИВ: товар без бонусов/фишек (0) — строка либо не отображается, либо модалка не ломается при клике', () => {
        cy.intercept('GET', '**/api/v3/product/*/offers', {
            statusCode: 200,
            body: { productId: 'test', bonuses: 0, chips: 0, prices: { basePrice: 1000, finalPrice: 1000 }, gifts: null, bundles: null },
        }).as('offersZero');
        cy.visit(productUrl);
        cy.wait('@offersZero');
        cy.get('body').then(($body) => {
            const bonusSection = $body.find('section:contains("бонус")').filter((i, el) => el.className.includes('cursor-pointer'));
            if (bonusSection.length === 0) {
                cy.log('Строка бонусов не отображается при bonuses=0/chips=0 — ожидаемо');
            } else {
                cy.wrap(bonusSection.first()).click();
                cy.get('[role="dialog"]').should('be.visible');
            }
        });
    });
});
