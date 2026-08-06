// Блок 2 из Mechta_ProductPage_TestCases.xlsx: избранное и сравнение с карточки товара
// (TC-FAV-01/02, TC-CMP-01/02). Разведка 2026-08-05:
// - Кнопки: #product-add-to-favorite_desktop (иконка heart/heart-fill),
//   #product-add-to-compare_desktop (иконка scales/scales-fill).
// - Состояние оптимистично меняется мгновенно И реально уходит на бэк даже для
//   АНОНИМНОЙ сессии (device-id-scoped, без логина): POST /api/v3/favorites/add
//   {productId: <product.id>} и POST /api/v2/compare {item_id: <product.numericId>},
//   снятие — .../delete. Корневой /product/{slug} содержит
//   userFlags: {inFavorite, inCompare, inBasket}.
// - ВАЖНО: localStorage-ключ 'user_device_id' (которым бэк опознаёт анонимную
//   сессию) подтверждённо МЕНЯЕТСЯ в течение первых секунд после захода на
//   страницу (до И без какого-либо reload) — вероятно, догружается "настоящий"
//   fingerprint взамен временного. Из-за этого сверка "пережило ли избранное
//   reload через прямой запрос к /favorites" ненадёжна — сам reload запрашивает
//   уже под ДРУГИМ device-id, чем тот, под которым реально добавляли. Поэтому
//   здесь проверяется именно то, что специфицировано в Excel (мгновенная
//   оптимистичная смена иконки + реальный подтверждённый запрос к API), без
//   сверки через принудительный reload.
// - НАЙДЕН БАГ (см. BUG-003): ошибка API при добавлении бросает необработанное
//   исключение (unhandled promise rejection) вместо отката UI/сообщения об ошибке.
import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();
const productUrl = '/product/smartfon-apple-iphone-15-128gb-pink/';

describe('Страница товара: избранное и сравнение (TC-FAV-01/02, TC-CMP-01/02)', () => {

    describe('Избранное', () => {

        it('TC-FAV-01: добавление в избранное — мгновенная смена иконки, подтверждена реальным запросом к API', () => {
            ProductPage.interceptRequests();
            ProductPage.interceptFavorites();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                expect(interception.response.body.userFlags.inFavorite, 'исходно товар не в избранном').to.eq(false);
                const productId = interception.response.body.id;

                ProductPage.clickFavorite();
                // Оптимистичная смена — иконка меняется до ответа API
                ProductPage.assertFavoriteIconState(true);

                cy.wait('@favoriteAdd').then(({ request, response }) => {
                    expect(response.statusCode).to.eq(204);
                    expect(request.body.productId).to.eq(productId);
                });
                // Иконка не откатывается сама по себе после успешного ответа
                ProductPage.assertFavoriteIconState(true);
            });
        });

        it('TC-FAV-02: удаление из избранного — иконка возвращается в исходное состояние, подтверждено API', () => {
            ProductPage.interceptRequests();
            ProductPage.interceptFavorites();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 });

            ProductPage.clickFavorite();
            cy.wait('@favoriteAdd');
            ProductPage.assertFavoriteIconState(true);

            ProductPage.clickFavorite();
            ProductPage.assertFavoriteIconState(false);
            cy.wait('@favoriteDelete').then(({ response }) => {
                expect(response.statusCode).to.eq(204);
            });
            ProductPage.assertFavoriteIconState(false);
        });

        // BugReport/Товар/product_page/BUG-003: ошибка API при добавлении в избранное роняет
        // страницу в необработанное исключение вместо отката/сообщения. Тест
        // целенаправленно проверяет ОЖИДАЕМОЕ поведение и падает, документируя баг.
        it('БАГ: ошибка API при добавлении в избранное не должна ронять страницу необработанным исключением — см. BUG-003', () => {
            cy.intercept('POST', '**/api/v3/favorites/add', { statusCode: 500, body: { error: 'internal' } }).as('favoriteAddError');
            cy.visit(productUrl);
            ProductPage.clickFavorite();
            cy.wait('@favoriteAddError');
            // Ожидаемое поведение: иконка откатывается назад (не остаётся ложно "в избранном")
            ProductPage.assertFavoriteIconState(false);
        });
    });

    describe('Сравнение', () => {

        it('TC-CMP-01: добавление в сравнение — мгновенная смена иконки, подтверждена реальным запросом к API', () => {
            ProductPage.interceptRequests();
            ProductPage.interceptCompare();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                expect(interception.response.body.userFlags.inCompare, 'исходно товар не в сравнении').to.eq(false);
                const numericId = interception.response.body.numericId;

                ProductPage.clickCompare();
                ProductPage.assertCompareIconState(true);

                cy.wait('@compareAdd').then(({ request, response }) => {
                    expect(response.statusCode).to.eq(200);
                    expect(request.body.item_id).to.eq(numericId);
                });
                ProductPage.assertCompareIconState(true);
            });
        });

        it('TC-CMP-02: удаление из сравнения — иконка возвращается в исходное состояние, подтверждено API', () => {
            ProductPage.interceptRequests();
            ProductPage.interceptCompare();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 });

            ProductPage.clickCompare();
            cy.wait('@compareAdd');
            ProductPage.assertCompareIconState(true);

            ProductPage.clickCompare();
            ProductPage.assertCompareIconState(false);
            cy.wait('@compareDelete');
            ProductPage.assertCompareIconState(false);
        });

        // Тот же корень, что и BUG-003 (см. блок "Избранное") — обработчик клика
        // на кнопке сравнения так же не оборачивает ошибку в try/catch
        it('БАГ: ошибка API при добавлении в сравнение не должна ронять страницу необработанным исключением — см. BUG-003', () => {
            cy.intercept('POST', '**/api/v2/compare', { statusCode: 500, body: { error: 'internal' } }).as('compareAddError');
            cy.visit(productUrl);
            ProductPage.clickCompare();
            cy.wait('@compareAddError');
            ProductPage.assertCompareIconState(false);
        });
    });
});
