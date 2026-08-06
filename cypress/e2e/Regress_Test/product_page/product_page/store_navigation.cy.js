// TC-STORE-02, TC-STORE-06 из Mechta_ProductPage_TestCases.xlsx: список магазинов
// самовывоза. Разведка 2026-08-05: кнопка "Показать все магазины" появляется, только
// когда /subdivisions возвращает БОЛЬШЕ адресов, чем помещается в свёрнутый список —
// подтверждено: у товара с 11 магазинами (fixtures.withReviews) изначально видно 4 +
// кнопка; у товара с 5 магазинами (fixtures.onlyShopwindow) кнопки нет вообще, видны
// все сразу (граничный случай — короткий список не нуждается в раскрытии).
import productPage from '../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: список магазинов самовывоза (TC-STORE-02, TC-STORE-06)', () => {

    describe('"Показать все магазины"', () => {

        it('TC-STORE-06: длинный список магазинов свёрнут, кнопка "Показать все магазины" раскрывает все адреса из /subdivisions', () => {
            ProductPage.interceptRequests();
            cy.fixture('products').then((p) => cy.visit(p.withReviews.url));
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const addresses = interception.response.body.map((s) => s.address);
                expect(addresses, 'фикстура должна иметь длинный список магазинов').to.have.length.greaterThan(5);

                cy.get('#product-shops').click();
                // Свёрнутый список показывает не все адреса сразу
                const hiddenAddress = addresses[addresses.length - 1];
                ProductPage.assertAddressNotVisibleInAvailability(hiddenAddress);

                ProductPage.clickShowAllStores();
                addresses.forEach((address) => {
                    ProductPage.assertAddressVisibleInAvailability(address);
                });
            });
        });

        it('ГРАНИЧНЫЙ: короткий список магазинов (5 шт.) показывается сразу целиком, без кнопки "Показать все"', () => {
            ProductPage.interceptRequests();
            cy.fixture('products').then((p) => cy.visit(p.onlyShopwindow.url));
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const addresses = interception.response.body.map((s) => s.address);
                expect(addresses, 'фикстура должна иметь короткий список магазинов').to.have.length.lessThan(6);

                cy.get('#product-shops').click();
                addresses.forEach((address) => {
                    ProductPage.assertAddressVisibleInAvailability(address);
                });
                cy.get('#availabilityBlock').contains('button', 'Показать все магазины').should('not.exist');
            });
        });
    });

    describe('Ошибка загрузки списка магазинов', () => {

        // TC-STORE-02 буквально ("страница 404 со ссылкой на главную") не подтверждён
        // разведкой для мока ошибки конкретно /subdivisions — проверяем инвариант
        // "страница не ломается и остаётся функциональной", а не гадаем формулировку
        it('НЕГАТИВ (аналог TC-STORE-02): ошибка /subdivisions не ломает страницу товара', () => {
            cy.intercept('GET', '**/api/v3/product/*/subdivisions', { statusCode: 500, body: { error: 'internal' } }).as('subdivisionsError');
            cy.fixture('products').then((p) => cy.visit(p.onlyShopwindow.url));
            cy.wait('@subdivisionsError');
            cy.get('#product-shops').should('be.visible').click();
            cy.get('#product-name').should('be.visible');
            cy.get('#product-add-to-basket').should('be.visible');
        });
    });
});
