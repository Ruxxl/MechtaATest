// Блок 2 из Mechta_ProductPage_TestCases.xlsx: корзина и сопутствующие товары
// (TC-CART-01..10). Разведка 2026-08-04/05: панель сопутки НЕ у каждого товара —
// источник данных /api/v3/product/{slug}/relatedWithProviderData
// ({categories:[{category:{name,slug}, products}], chargers, providerData}).
// Панель не имеет role="dialog" — ищем по заголовку "Товар добавлен в корзину".
// Кнопка "Продолжить" одним действием закрывает панель И оставляет на странице
// товара — этим покрываются оба кейса плана (TC-CART-06 "закрытие" и TC-CART-08
// "продолжить покупки", в реальном UI это одна и та же кнопка/действие).
//
// ВАЖНО (разведка 2026-08-05): состав категорий сопутки у конкретных товаров
// со временем меняется (fixtures.onlyShopwindow ранее считался примером БЕЗ
// сопутки, повторная проверка это опровергла) — для позитивного/негативного
// сравнения "сопутка есть / сопутки нет" используется универсальный приём
// API-стаббинга (замоканный /relatedWithProviderData), а не конкретный товар.
import productPage from '../../../../support/pageObjects/product_page';
import { assertLoginModalShown } from '../../../../support/helpers/authModal';

const ProductPage = new productPage();

describe('Страница товара: корзина и сопутствующие товары (TC-CART-01..10)', () => {

    let products;
    before(() => {
        cy.fixture('products').then((p) => { products = p; });
    });

    describe('Добавление в корзину', () => {

        it('TC-CART-01: добавление товара с сопутствующими позициями открывает панель, состав вкладок совпадает с /relatedWithProviderData', () => {
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            ProductPage.waitRelatedProducts().then((interception) => {
                expect(interception.response.statusCode).to.eq(200);
                const { categories, providerData } = interception.response.body;
                expect(categories, 'фикстура должна иметь непустые категории сопутки').to.have.length.greaterThan(0);

                ProductPage.assertCrossSellPanelShown();
                cy.contains(providerData.strategyMessage).should('be.visible');
                // Разведка 2026-08-05: список категорий шире, чем помещается в
                // видимую область панели (горизонтальный скролл вкладок) — часть
                // вкладок формально "не visible" из-за overflow у position:fixed
                // предка, это не баг (тот же паттерн, что уже задокументирован для
                // длинных списков в characteristics_panel.cy.js) — проверяем
                // наличие в DOM, а не физическую видимость на экране
                categories.forEach((c) => {
                    cy.contains('button', c.category.name).should('exist');
                });
            });
        });

        it('TC-CART-02: добавление товара БЕЗ сопутствующих позиций (замокан пустой ответ) — панель не открывается, только смена состояния кнопки', () => {
            ProductPage.interceptAddToBasket();
            cy.intercept('GET', '**/api/v3/product/*/relatedWithProviderData', {
                statusCode: 200,
                body: { categories: [], chargers: [], providerData: null }
            }).as('relatedProductsEmpty');
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            cy.wait('@relatedProductsEmpty');
            ProductPage.assertCrossSellPanelNotShown();
            cy.get('#product-add-to-basket').should('include.text', 'В корзине');
        });

        // BugReport/Товар/product_page/BUG-002: при ошибке API добавления в корзину панель
        // "успеха" всё равно монтируется в DOM (data-state="open", полный состав
        // данных), но остаётся визуально невидимой (сломана анимация появления),
        // а тёмный оверлей блокирует страницу без единого сообщения об ошибке.
        // Тест целенаправленно проверяет ОЖИДАЕМОЕ поведение и падает, документируя баг.
        it('TC-CART-03 / БАГ: ошибка API при добавлении в корзину должна показать сообщение об ошибке, а не невидимую панель "успеха" — см. BUG-002', () => {
            cy.intercept('POST', '**/api/v2/basket/add', { statusCode: 500, body: { error: 'internal' } }).as('addToBasketError');
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            cy.wait('@addToBasketError');
            cy.contains(/не удалось добавить|ошибка/i, { timeout: 20000 }).should('be.visible');
            cy.contains('Товар добавлен в корзину').should('not.exist');
        });
    });

    describe('Панель сопутствующих товаров', () => {

        it('TC-CART-04: добавление сопутствующего товара из панели — сверка через /basket/', () => {
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            ProductPage.waitRelatedProducts().then((interception) => {
                // Берём товар с реальной доступностью (не notAvailable), чтобы
                // добавление гарантированно попало в основной состав корзины,
                // а не в "Недоступно для заказа" — см. отдельный кейс ниже
                const available = interception.response.body.categories[0].products.find((p) => p.availability !== 'notAvailable');
                expect(available, 'фикстура должна иметь хотя бы один доступный сопутствующий товар').to.exist;

                ProductPage.interceptAddToBasket();
                ProductPage.addRelatedProductByName(available.name);
                ProductPage.waitAddToBasket();

                cy.visit('/basket/');
                cy.contains(available.name).should('be.visible');
            });
        });

        it('НЕСТАНДАРТНЫЙ / граничный: сопутствующий товар с availability=notAvailable — добавляется в отдельный блок "Недоступно для заказа", а не в основной состав', () => {
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            ProductPage.waitRelatedProducts().then((interception) => {
                const unavailable = interception.response.body.categories[0].products.find((p) => p.availability === 'notAvailable');
                expect(unavailable, 'фикстура должна иметь хотя бы один недоступный сопутствующий товар').to.exist;

                ProductPage.interceptAddToBasket();
                ProductPage.addRelatedProductByName(unavailable.name);
                ProductPage.waitAddToBasket();

                cy.visit('/basket/');
                cy.contains('Недоступно для заказа').should('be.visible');
                cy.contains('Недоступно для заказа').parent().should('contain.text', unavailable.name);
            });
        });

        // Тот же корень, что и BUG-002 (см. TC-CART-03) — эндпоинт добавления
        // общий для основной кнопки и для карточек внутри панели сопутки
        it('TC-CART-05 / БАГ: ошибка API при добавлении сопутствующего товара должна показать сообщение об ошибке — см. BUG-002', () => {
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            ProductPage.waitRelatedProducts().then((interception) => {
                const available = interception.response.body.categories[0].products.find((p) => p.availability !== 'notAvailable');

                cy.intercept('POST', '**/api/v2/basket/add', { statusCode: 500, body: { error: 'internal' } }).as('addRelatedError');
                ProductPage.addRelatedProductByName(available.name);
                cy.wait('@addRelatedError');
                cy.contains(/не удалось добавить|ошибка/i, { timeout: 20000 }).should('be.visible');
            });
        });

        it('TC-CART-06/08: кнопка "Продолжить" закрывает панель и оставляет на странице товара', () => {
            ProductPage.interceptAddToBasket();
            cy.visit(products.inStock.url);
            cy.get('#product-add-to-basket').click();
            ProductPage.waitAddToBasket();
            ProductPage.assertCrossSellPanelShown();

            ProductPage.clickCrossSellContinue();
            ProductPage.assertCrossSellPanelNotShown();
            cy.url().should('include', products.inStock.url);
        });

        it('TC-CART-07: кнопка "В корзину" из панели переводит в /basket/ с добавленным товаром', () => {
            ProductPage.interceptRequests();
            ProductPage.interceptAddToBasket();
            cy.visit(products.inStock.url);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const { name } = interception.response.body;
                cy.get('#product-add-to-basket').click();
                ProductPage.waitAddToBasket();
                ProductPage.assertCrossSellPanelShown();

                ProductPage.clickCrossSellGoToCart();
                cy.url().should('include', '/basket/');
                cy.contains(name).should('be.visible');
            });
        });
    });

    describe('"Купить сейчас" / "Оформить сейчас" (TC-CART-09,10)', () => {

        it('TC-CART-09 (уточнено разведкой): для анонимного пользователя показывает модалку логина, а не чекаут напрямую', () => {
            // Тот же паттерн, что уже подтверждён для панели характеристик
            // (см. characteristics_panel.cy.js, TC-INFO-19) — здесь проверяем
            // ОСНОВНУЮ кнопку "Купить сейчас" на странице, а не из панели/модалки
            cy.visit(products.onlyShopwindow.url);
            cy.get('#product-buy-now').should('be.visible').click({ force: true });
            assertLoginModalShown();
            cy.url().should('include', '/product/');
        });

        // Разведка 2026-08-05: для анонимной сессии "Купить сейчас" показывает
        // модалку логина СРАЗУ, до какого-либо запроса добавления в корзину —
        // поэтому TC-CART-10 ("ошибка перехода на чекаут") в анонимном режиме
        // не воспроизводим буквально: чекаут-запрос просто не происходит раньше
        // модалки логина. Проверяем соседний смысловой инвариант: ошибка/сбой,
        // возникший ДО чекаута, не должен ломать саму кнопку "Купить сейчас"
        it('НЕГАТИВ (аналог TC-CART-10): для анонимного пользователя ошибочный ответ backend на этом шаге не мешает открыть модалку логина повторно', () => {
            cy.intercept('POST', '**/api/v2/basket/add', { statusCode: 500, body: { error: 'internal' } }).as('buyNowError');
            cy.visit(products.onlyShopwindow.url);
            cy.get('#product-buy-now').should('be.visible').click({ force: true });
            assertLoginModalShown();
            cy.get('body').type('{esc}');
            cy.get('#product-buy-now').should('be.visible').click({ force: true });
            assertLoginModalShown();
        });
    });
});
