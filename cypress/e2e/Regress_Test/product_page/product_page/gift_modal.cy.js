// Блок 1 из Mechta_ProductPage_TestCases.xlsx: модалка выбора подарка (TC-INFO-03..08).
// Разведка 2026-08-04 на fixtures.withGift (Infinix Hot 60 PRO): /offers.gifts —
// массив МАССИВОВ (каждый подмассив = одна вкладка модалки), у этого товара 3
// вкладки ("Первый подарок 2", "Второй подарок 1", "Третий подарок 1") — числа в
// названиях вкладок это gifts[i].length. Модалка: role="dialog", варианты подарка —
// button[role="radio"], кнопки "Отмена"/"Выбрать подарок", закрывается кликом вне
// модалки (нативного крестика в DOM не нашли — возможно, есть, но не через <svg>).
import productPage from '../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: модалка выбора подарка (TC-INFO-03..08)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.withGift.url; });
    });

    it('TC-INFO-03: открытие модалки — вкладки и варианты совпадают с gifts из /offers', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
            const { gifts } = interception.response.body;
            expect(gifts, 'фикстура должна иметь >1 категории подарков').to.have.length.greaterThan(1);

            ProductPage.openGiftModal();
            cy.get('[role="dialog"]').should('be.visible');
            ProductPage.giftModalTabs.should('have.length', gifts.length);

            gifts[0].forEach((gift) => {
                cy.contains('[role="dialog"]', gift.name).should('be.visible');
            });
        });
    });

    it('TC-INFO-04: выбор одного подарка и подтверждение — добавляется в корзину, модалка закрывается', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
            const gift = interception.response.body.gifts[0][0];

            ProductPage.openGiftModal();
            ProductPage.selectGiftOption(0);
            ProductPage.interceptAddToBasket();
            ProductPage.confirmGiftSelection();
            ProductPage.waitAddToBasket();
            cy.get('[role="dialog"]').should('not.exist');

            cy.visit('/basket/');
            cy.contains(gift.name).should('be.visible');
        });
    });

    it('TC-INFO-05 (закрытие модалки Esc — клик по оверлею роняет Electron-рендерер, см. skill п.4): без выбора — состав корзины не меняется', () => {
        // Клик по body через pointer-events:none оверлей ({force:true}) стабильно
        // валит Electron-рендерер Cypress (renderer process crashed) — заменили на
        // Esc, тот же пользовательский результат (закрытие без выбора), без риска.
        // Сравнение ВСЕГО текста страницы /basket/ до/после ловило страницу ДО
        // полной отрисовки (SSR-заглушку) — заменили на устойчивый маркер состояния
        cy.visit('/basket/');
        cy.contains('Корзина пуста', { timeout: 20000 }).should('be.visible');

        cy.visit(productUrl);
        ProductPage.openGiftModal();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('body').type('{esc}');
        cy.get('[role="dialog"]').should('not.exist');
        cy.visit('/basket/');
        cy.contains('Корзина пуста', { timeout: 20000 }).should('be.visible');
    });

    it('TC-INFO-06: кнопка "Отменить" — подарок не добавляется, даже если был отмечен', () => {
        cy.visit(productUrl);
        ProductPage.openGiftModal();
        ProductPage.selectGiftOption(0);
        ProductPage.cancelGiftSelection();
        cy.get('[role="dialog"]').should('not.exist');
        cy.visit('/basket/');
        cy.contains('Корзина пуста').should('be.visible');
    });

    it('TC-INFO-08: выбор подарков на РАЗНЫХ вкладках — оба выбранных подарка добавляются в корзину', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
            const { gifts } = interception.response.body;
            const firstTabGift = gifts[0][0];
            const secondTabGift = gifts[1][0];

            ProductPage.openGiftModal();
            ProductPage.selectGiftOption(0); // подарок из первой (уже открытой) вкладки
            ProductPage.clickGiftModalTab(1);
            ProductPage.selectGiftOption(0); // подарок из второй вкладки
            ProductPage.interceptAddToBasket();
            ProductPage.confirmGiftSelection();
            ProductPage.waitAddToBasket();

            cy.visit('/basket/');
            cy.contains(firstTabGift.name).should('be.visible');
            cy.contains(secondTabGift.name).should('be.visible');
        });
    });
});
