import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();

// Область "На витрине" (onlyShopwindow) — первая из папок product_page/product_<флаг>/,
// тестирующих ВСЮ страницу товара, заякорившись на товаре с конкретным флагом.
// В дальнейшем аналогичные папки появятся для других флагов (product_withGift,
// product_withDiscount и т.д.) — см. TestPlans/PDP-product-page-testplan.md.
//
// Основной товар — cypress/fixtures/products.json -> onlyShopwindow (кондиционер,
// подтверждено 2026-08-04: onlyShopwindow=true, ВСЕ 7 магазинов в /subdivisions
// витринные). Негативный товар — fixtures.withDiscount (onlyShopwindow=false).
describe('Страница товара "На витрине" (onlyShopwindow): стикер и блок самовывоза', () => {

    let products;
    before(() => {
        cy.fixture('products').then((p) => { products = p; });
    });

    describe('Стикер "На витрине"', () => {

        it('ПОЗИТИВ: товар с onlyShopwindow=true — стикер виден и текст соответствует API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.assertOnlyShopwindowStickerMatchesApi();
        });

        it('НЕГАТИВ: товар с onlyShopwindow=false — стикер отсутствует в DOM (не просто невидим)', () => {
            ProductPage.interceptRequests();
            cy.visit(products.withDiscount.url);
            ProductPage.assertOnlyShopwindowStickerMatchesApi();
        });
    });

    describe('Согласованность /subdivisions', () => {

        it('ПОЗИТИВ: для витринного товара — во ВСЕХ магазинах onlyShopwindow=true и stock="На витрине"', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.assertSubdivisionsShopwindowConsistency();
        });

        it('НЕГАТИВ: для обычного товара — там, где onlyShopwindow=false, stock не равен "На витрине"', () => {
            ProductPage.interceptRequests();
            cy.visit(products.withDiscount.url);
            ProductPage.assertSubdivisionsShopwindowConsistency();
        });

        it('ПОЗИТИВ: каждый магазин из /subdivisions реально отображается в блоке "Доступно на самовывоз"', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const addresses = interception.response.body.map((s) => s.address);
                expect(addresses).to.have.length.greaterThan(0);
                addresses.forEach((address) => ProductPage.assertAddressVisibleInAvailability(address));
            });
        });
    });

    describe('Чекбокс "Скрыть витрину"', () => {

        it('НЕСТАНДАРТНЫЙ / БАГ: на товаре, где ВСЕ магазины витринные, "Скрыть витрину" даёт пустой список — см. BUG-001', () => {
            // BugReport/Товар/product_page/BUG-001: список корректно фильтруется до 0 строк, но
            // заголовок блока не пересчитывается ("7 магазинов" остаётся) и нет
            // сообщения "не найдено" — тест целенаправленно проверяет ОЖИДАЕМОЕ
            // поведение и падает, документируя баг
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const addresses = interception.response.body.map((s) => s.address);
                ProductPage.toggleHideShopwindow();

                addresses.forEach((address) => ProductPage.assertAddressNotVisibleInAvailability(address));

                cy.contains(/доступно на самовывоз \(0 магазин/i)
                    .should('exist');
            });
        });

        it('НЕСТАНДАРТНЫЙ: повторный клик по "Скрыть витрину" возвращает список к исходному состоянию', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const firstAddress = interception.response.body[0].address;

                ProductPage.toggleHideShopwindow();
                ProductPage.assertAddressNotVisibleInAvailability(firstAddress);

                ProductPage.toggleHideShopwindow();
                ProductPage.assertAddressVisibleInAvailability(firstAddress);
            });
        });
    });

    describe('Поиск магазина', () => {

        it('ПОЗИТИВ: поиск по фрагменту адреса находит только совпадающие магазины', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const target = interception.response.body[0];
                const others = interception.response.body.slice(1);
                // Ищем по уникальному фрагменту (последние слова адреса), чтобы не
                // случайно задеть другой адрес с общим префиксом вроде "ул."
                const fragment = target.address.split(',').pop().trim();

                ProductPage.searchStore(fragment);
                ProductPage.assertAddressVisibleInAvailability(target.address);
                others
                    .filter((s) => !s.address.includes(fragment))
                    .forEach((s) => ProductPage.assertAddressNotVisibleInAvailability(s.address));
            });
        });

        it('НЕГАТИВ (equivalence partitioning): поиск несуществующего магазина — пустой результат, страница не падает', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.searchStore('zzz-несуществующий-магазин-qqq-999');
            cy.get('body').should('be.visible');
            cy.get('#availabilityBlock').should('not.contain.text', 'ул.').and('not.contain.text', 'пр.');
        });

        it('ГРАНИЧНЫЙ (boundary value): очень длинная строка поиска (200+ символов) не ломает страницу', () => {
            // Значение вставляется программно (invoke('val') + trigger('input')),
            // а не через посимвольный cy.type() — реальная посимвольная печать
            // строки в 500 символов стабильно роняла Electron-рендерер Cypress
            // (renderer process crashed) ещё до того, как страница успевала на
            // это отреагировать — сам по себе не баг сайта, а способ ввода
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.storeSearchInput
                .invoke('val', 'а'.repeat(200))
                .trigger('input');
            cy.get('body').should('be.visible');
            cy.get('#product-add-to-basket').should('be.visible');
        });

        it('ГРАНИЧНЫЙ (негатив, спецсимволы/XSS): поиск со спецсимволами не отражает скрипт и не ломает страницу', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.searchStore('<script>alert(1)</script>');
            cy.get('body').should('be.visible');
            cy.get('body').invoke('html').should('not.include', '<script>alert(1)</script>');
        });

        it('НЕСТАНДАРТНЫЙ (комбинация фильтров): поиск + "Скрыть витрину" одновременно на полностью витринном товаре — пусто без падения', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
                const fragment = interception.response.body[0].address.split(',').pop().trim();
                ProductPage.searchStore(fragment);
                ProductPage.toggleHideShopwindow();
                cy.get('body').should('be.visible');
                cy.get('#availabilityBlock').should('not.contain.text', 'ул.').and('not.contain.text', 'пр.');
            });
        });
    });

    describe('Негативные / граничные (общие для товара)', () => {

        it('Несуществующий товар: страница недоступна, а не сломана', () => {
            cy.fixture('testData').then((testData) => {
                cy.visit(testData.nonExistentProductUrl, { failOnStatusCode: false });
                cy.get('#product-add-to-basket').should('not.exist');
                cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible');
            });
        });
    });
});
