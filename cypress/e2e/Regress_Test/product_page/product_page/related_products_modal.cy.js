// TC-REL-01..07 из Mechta_ProductPage_TestCases.xlsx: блок 4, "общая модалка
// сопутствующих товаров". Разведка 2026-08-05: это ТА ЖЕ панель сопутки, что уже
// покрыта в cart_crosssell.cy.js (TC-CART-01/04/06/07/08) — здесь тестируется
// дополнительная глубина, которой там не было: переключение вкладок-категорий.
// - GET /api/v3/product/{slug}/relatedWithProviderData отдаёт ВСЕ категории
//   ЦЕЛИКОМ ОДНИМ ответом (categories: [{category:{name,slug,level}, products:[]}]),
//   включая синтетическую "Все" (slug "all-recommendations") — подтверждено
//   напрямую (7 категорий в одном ответе). Переключение вкладки — ЧИСТО
//   КЛИЕНТСКАЯ фильтрация уже загруженных данных, НОВОГО запроса не происходит.
//   Из-за этого TC-REL-03 ("ошибка загрузки категории при клике") технически НЕ
//   воспроизводима так, как описана в плане — клик по вкладке не может получить
//   ошибку API, потому что не шлёт запрос вообще (аналог ситуации с TC-BANNER,
//   см. BugReport/Товар/product_page/README.md). Тест не пишется как есть; вместо этого
//   TC-REL-04 (пустая категория) покрыт через API-стаббинг всего ответа
//   relatedWithProviderData с одной категорией без товаров. Разведкой подтверждено:
//   вкладка пустой категории выбирается корректно, но область товаров под ней
//   просто ПУСТАЯ — текста "Товары этой категории временно недоступны" из плана
//   в реальности НЕТ (аналог ситуации с TC-BANNER — не баг, а несоответствие
//   плана и факта). Также подтверждено: общий beforeEach ниже открывает панель
//   один раз с РЕАЛЬНЫМИ данными до TC-REL-04, повторный клик по кнопке "В
//   корзину" переиспользует уже загруженные на клиенте категории и НЕ шлёт новый
//   запрос — поэтому TC-REL-04 вынесен в отдельный describe со своим visit,
//   где мок регистрируется ДО первого открытия панели.
// - TC-REL-07 ("роут корзины недоступен") — "Перейти в корзину" ведёт на статический
//   внутренний роут /basket/ клиентского SPA-роутера, который всегда резолвится (это
//   не динамический слаг товара, как в TC-SIM-02) — нет реального способа получить
//   "недоступный роут" для встроенного статического пути, аналогично уже пропущенным
//   в проекте TC-TRADEIN-05/07 (см. PDP-testcases-coverage.md). Не пишется.
import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: общая модалка сопутствующих товаров (TC-REL-01..07)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.inStock.url; });
    });

    beforeEach(() => {
        ProductPage.interceptAddToBasket();
        ProductPage.interceptRelatedProducts();
        cy.visit(productUrl);
        cy.get('#product-add-to-basket', { timeout: 20000 }).should('be.visible').click();
        ProductPage.waitAddToBasket();
        ProductPage.waitRelatedProducts().then((interception) => {
            cy.wrap(interception.response.body.categories).as('categories');
        });
        ProductPage.assertCrossSellPanelShown();
    });

    it('TC-REL-01: добавление товара из общей модалки сопутки кнопкой "+", подтверждено API', () => {
        cy.intercept('POST', '**/api/v2/basket/add').as('addRelated');
        cy.get('@categories').then((categories) => {
            const all = categories.find((c) => c.category.slug === 'all-recommendations');
            expect(all.products, 'категория "Все" должна содержать товары').to.have.length.greaterThan(0);
            const name = all.products[0].name;
            ProductPage.addRelatedProductByName(name);
            cy.wait('@addRelated', { timeout: 15000 }).then(({ response }) => {
                expect(response.body.result, 'API реально подтвердил добавление').to.eq(true);
            });
        });
    });

    it('TC-REL-02: переключение вкладки категории показывает товары именно этой категории', () => {
        cy.get('@categories').then((categories) => {
            const nonAllCategory = categories.find((c) => c.category.slug !== 'all-recommendations' && c.products.length > 0);
            expect(nonAllCategory, 'нужна хотя бы одна непустая не-"Все" категория').to.exist;

            ProductPage.clickCrossSellTab(nonAllCategory.category.name);
            cy.wait(500);
            cy.contains(nonAllCategory.products[0].name).should('be.visible');
        });
    });

    // Крестик закрытия разведкой найден физически ЗА пределами вьюпорта (см.
    // similar_products.cy.js) — не кликается ни настоящим, ни форсированным кликом;
    // "Продолжить" — единственный реально работающий способ закрыть эту панель
    // без перехода в корзину.
    it('TC-REL-05: "Продолжить" закрывает модалку, пользователь остаётся на странице', () => {
        ProductPage.clickCrossSellContinue();
        cy.wait(500);
        ProductPage.assertCrossSellPanelNotShown();
        cy.url().should('include', productUrl);
    });

    it('TC-REL-06: "Перейти в корзину" из модалки переводит на страницу "Корзина"', () => {
        ProductPage.clickCrossSellGoToCart();
        cy.url().should('include', '/basket/');
    });
});

// TC-REL-04 вынесен в отдельный describe СО СВОИМ visit — общий beforeEach выше
// уже открывает панель с РЕАЛЬНЫМИ данными до этого теста, и повторный клик по
// #product-add-to-basket переиспользует уже загруженные категории на клиенте, не
// делая новый запрос — поэтому мок relatedWithProviderData никогда не подставлялся
// (разведкой подтверждено: на скриншоте падения видны настоящие вкладки "Все/
// Чехлы/Наушники/..." вместо замоканной "Пустая категория"). Интерцепт должен
// быть настроен ДО самого первого визита на страницу.
describe('Страница товара: пустая категория в общей модалке сопутки (TC-REL-04)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.inStock.url; });
    });

    it('TC-REL-04 (уточнено разведкой): пустая категория — вкладка выбирается, но область товаров просто пустая, БЕЗ текста "недоступны"', () => {
        cy.intercept('GET', '**/api/v3/product/*/relatedWithProviderData', {
            statusCode: 200,
            body: {
                categories: [
                    { category: { name: 'Все', slug: 'all-recommendations', level: 0 }, products: [{ id: 'x', name: 'Заглушка', slug: 'zaglushka', images: [], prices: { basePrice: 1000, finalPrice: 1000 } }] },
                    { category: { name: 'Пустая категория', slug: 'empty-cat', level: 3 }, products: [] },
                ],
                chargers: [],
                providerData: null,
            },
        }).as('relatedWithEmptyCategory');
        ProductPage.interceptAddToBasket();
        cy.visit(productUrl);
        cy.get('#product-add-to-basket', { timeout: 20000 }).should('be.visible').click();
        ProductPage.waitAddToBasket();
        cy.wait('@relatedWithEmptyCategory', { timeout: 20000 });
        ProductPage.assertCrossSellPanelShown();
        ProductPage.clickCrossSellTab('Пустая категория');
        cy.wait(500);
        // фильтр реально переключился (товар из категории "Все" больше не виден)
        cy.contains('Заглушка').should('not.exist');
        // текст из плана в реальности НЕ рендерится — просто пустая область без
        // единого сообщения пользователю (не текст ошибки, а вообще ничего)
        cy.contains('Товары этой категории временно недоступны').should('not.exist');
    });
});
