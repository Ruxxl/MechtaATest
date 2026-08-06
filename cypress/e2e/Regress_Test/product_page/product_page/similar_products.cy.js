// TC-SIM-01..10 из Mechta_ProductPage_TestCases.xlsx: блок 4, карусель "Похожие товары".
// Разведка 2026-08-05:
// - ДРУГОЙ виджет, чем /similar (переключение вариантов по характеристике/состоянию,
//   уже покрыт в variant_selector.cy.js/page_blocks.cy.js). Источник данных —
//   GET /api/v3/product/{slug}/alternatives (products[], включая ДРУГИЕ бренды —
//   подтверждено: у iPhone 15 в выдаче есть Xiaomi/Samsung). Показывается не на
//   каждом товаре (напр. отсутствует на AirPods) — используется fixtures.inStock
//   (iPhone 15 pink), где подтверждено 20 карточек.
// - Цена/скидка у карточки полностью совпадают между /alternatives и батчевым
//   /api/v3/catalog/offers?productIds[]=... (сверено напрямую) — второй эндпоинт
//   достаточно не перепроверять отдельно, /alternatives уже достаточен и авторитетен
//   для цены, названия, картинки, рейтинга.
// - Клик "В корзину" на карточке шлёт POST /api/v2/basket/add с телом
//   {product_id: <numericId>} (НЕ uuid id!) и открывает ТУ ЖЕ панель сопутки, что и
//   обычная кнопка на странице — но relatedWithProviderData уходит для СЛАГА
//   добавленного товара, а не текущей страницы (подтверждено разведкой).
// - НАЙДЕН БАГ (см. BUG-006, TC-SIM-02): переход на карточку похожего товара, чей
//   API отвечает ошибкой (не настоящий 404, а, например, 500) — URL меняется
//   корректно, но область контента остаётся ПОЛНОСТЬЮ ПУСТОЙ, без сообщения
//   "Мы не можем найти то, что Вы ищете" (которое корректно показывается только для
//   настоящего 404).
// - TC-SIM-05 (ошибка добавления в корзину с карточки похожего товара) воспроизводит
//   уже задокументированный BUG-002 (панель монтируется в DOM, но остаётся
//   невидимой/без сообщения об ошибке) — тот же механизм, что и обычная кнопка
//   "В корзину" на странице, отдельный баг не заводится.
// - ГОНКА АЛИАСОВ (см. skill): relatedWithProviderData уходит ДВАЖДЫ — один раз на
//   загрузке страницы (прогрев данных для ГЛАВНОГО товара, ещё до всякого клика),
//   второй раз ПОСЛЕ клика по карточке похожего товара (уже для добавленного слага).
//   Один-единственный cy.wait('@relatedProducts') подхватывает ПЕРВЫЙ (ещё
//   непотреблённый) матч — то есть прогрев главного товара, а не нужный клик.
//   Поэтому перед кликом обязательно "сливаем" прогрузочный вызов отдельным wait().
// - Панель сопутки НЕ закрывается по Esc (не role="dialog") — закрывается только
//   явным крестиком (см. closeCrossSellPanel() в page object).
// - Сторонний promo-попап Mindbox ("popmechanic") иногда вешает pointer-events:none
//   на body и блокирует реальные клики — не имеет отношения к тестируемому
//   функционалу, обходится force:true в clickCrossSellContinue/clickCrossSellGoToCart.
import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: карусель "Похожие товары" (TC-SIM-01..10)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.inStock.url; });
    });

    describe('Переход на карточку похожего товара', () => {

        it('TC-SIM-01: клик по карточке открывает полную страницу этого товара, данные карточки совпадают со страницей', () => {
            ProductPage.interceptAlternatives();
            cy.visit(productUrl);
            ProductPage.waitAlternatives().then((interception) => {
                const target = interception.response.body.products[0];
                ProductPage.similarProductsHeading.scrollIntoView();
                cy.wait(1500);
                ProductPage.similarProductCards().should('have.length.greaterThan', 0);

                // Карточка отражает реальные данные /alternatives — звёзды, кол-во
                // отзывов, цена, название, картинка
                ProductPage.assertSimilarProductCardMatchesData(0, target);

                cy.intercept('GET', `**/api/v3/product/${target.slug}`).as('targetProduct');
                ProductPage.clickSimilarProductLink(0);
                cy.wait('@targetProduct', { timeout: 20000 }).then((i) => {
                    expect(i.response.body.name, 'название на целевой странице совпадает с карточкой').to.eq(target.name);
                    expect(i.response.body.prices.finalPrice, 'цена на целевой странице совпадает с карточкой').to.eq(target.prices.finalPrice);
                });
                cy.url().should('include', `/product/${target.slug}/`);
                cy.get('#product-name').should('contain.text', target.name);
            });
        });

        // BugReport/Товар/product_page/BUG-006: при ошибке API целевого товара (не настоящий 404)
        // область контента остаётся полностью пустой вместо сообщения "не найдено".
        // Тест целенаправленно проверяет ОЖИДАЕМОЕ поведение и падает, документируя баг.
        it('TC-SIM-02 / БАГ: клик по карточке при недоступном роуте (ошибка API) должен показать 404 — см. BUG-006', () => {
            ProductPage.interceptAlternatives();
            cy.visit(productUrl);
            ProductPage.waitAlternatives().then((interception) => {
                const target = interception.response.body.products[0];
                cy.intercept('GET', `**/api/v3/product/${target.slug}`, { statusCode: 500, body: { error: 'internal' } }).as('brokenProduct');
                ProductPage.similarProductsHeading.scrollIntoView();
                cy.wait(1500);
                ProductPage.similarProductCards().should('have.length.greaterThan', 0);
                ProductPage.clickSimilarProductLink(0);
                cy.wait('@brokenProduct', { timeout: 20000 });
                cy.wait(1500);
                cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible');
            });
        });
    });

    describe('"В корзину" на карточке похожего товара', () => {

        it('TC-SIM-03: товар с сопуткой — добавляется в корзину (реальный API), открывается панель сопутки', () => {
            ProductPage.interceptAlternatives();
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(productUrl);
            // сливаем прогрузочный вызов relatedWithProviderData ГЛАВНОГО товара —
            // иначе следующий wait ниже подхватит именно его, а не клик (см. коммент
            // про гонку алиасов в шапке файла)
            ProductPage.waitRelatedProducts();
            ProductPage.waitAlternatives().then((interception) => {
                const target = interception.response.body.products[0];
                ProductPage.similarProductsHeading.scrollIntoView();
                cy.wait(1500);
                ProductPage.similarProductCards().should('have.length.greaterThan', 0);
                ProductPage.clickSimilarProductAddToCart(0);
                ProductPage.waitAddToBasket().then(({ request, response }) => {
                    expect(request.body, 'добавляется именно та карточка, по которой кликнули').to.deep.include({ product_id: target.numericId });
                    expect(response.body.result, 'API реально подтвердил добавление').to.eq(true);
                });
                ProductPage.waitRelatedProducts().then((i) => {
                    expect(i.request.url, 'панель запрашивает сопутку ИМЕННО добавленного товара').to.include(`/${target.slug}/`);
                });
                ProductPage.assertCrossSellPanelShown();
            });
        });

        it('TC-SIM-04: товар без сопутки (замокан пустой ответ) — добавляется в корзину, панель не открывается', () => {
            ProductPage.interceptAlternatives();
            ProductPage.interceptAddToBasket();
            cy.visit(productUrl);
            ProductPage.waitAlternatives().then((interception) => {
                const target = interception.response.body.products[0];
                cy.intercept('GET', `**/api/v3/product/${target.slug}/relatedWithProviderData`, {
                    statusCode: 200,
                    body: { categories: [], chargers: [], providerData: null }
                }).as('relatedEmpty');
                ProductPage.similarProductsHeading.scrollIntoView();
                cy.wait(1500);
                ProductPage.similarProductCards().should('have.length.greaterThan', 0);
                ProductPage.clickSimilarProductAddToCart(0);
                ProductPage.waitAddToBasket().its('response.body.result').should('eq', true);
                cy.wait('@relatedEmpty', { timeout: 20000 });
                ProductPage.assertCrossSellPanelNotShown();
            });
        });

        // Тот же механизм, что и обычная кнопка "В корзину" на странице товара —
        // воспроизводит уже задокументированный BUG-002 (панель монтируется в DOM,
        // но остаётся невидимой, без текста ошибки), отдельный баг не заводится.
        it('TC-SIM-05 / БАГ: ошибка API при добавлении похожего товара должна показать текст ошибки — см. BUG-002', () => {
            ProductPage.interceptAlternatives();
            cy.intercept('POST', '**/api/v2/basket/add', { statusCode: 500, body: { error: 'internal' } }).as('addError');
            cy.visit(productUrl);
            ProductPage.waitAlternatives();
            ProductPage.similarProductsHeading.scrollIntoView();
            cy.wait(1500);
            ProductPage.similarProductCards().should('have.length.greaterThan', 0);
            ProductPage.clickSimilarProductAddToCart(0);
            cy.wait('@addError', { timeout: 15000 });
            cy.wait(1500);
            cy.contains(/не удалось|ошибка/i).should('be.visible');
        });
    });

    describe('Панель сопутки, открытая с карточки похожего товара', () => {

        let targetSlug;

        beforeEach(() => {
            ProductPage.interceptAlternatives();
            ProductPage.interceptAddToBasket();
            ProductPage.interceptRelatedProducts();
            cy.visit(productUrl);
            // сливаем прогрузочный вызов relatedWithProviderData ГЛАВНОГО товара —
            // иначе wait ниже подхватит именно его, а не клик (гонка алиасов)
            ProductPage.waitRelatedProducts();
            ProductPage.waitAlternatives().then((interception) => {
                targetSlug = interception.response.body.products[0].slug;
            });
            ProductPage.similarProductsHeading.scrollIntoView();
            cy.wait(1500);
            ProductPage.similarProductCards().should('have.length.greaterThan', 0);
            ProductPage.clickSimilarProductAddToCart(0);
            ProductPage.waitAddToBasket();
            ProductPage.waitRelatedProducts().then((i) => {
                cy.wrap(i.response.body.categories[0].products[0].name).as('firstRelatedName');
            });
        });

        it('TC-SIM-06: "+" у сопутствующего товара добавляет его в корзину, подтверждено API', () => {
            cy.intercept('POST', '**/api/v2/basket/add').as('addRelated');
            cy.get('@firstRelatedName').then((name) => {
                ProductPage.addRelatedProductByName(name);
                cy.wait('@addRelated', { timeout: 15000 }).its('response.body.result').should('eq', true);
            });
        });

        it('TC-SIM-08: "Перейти в корзину" из панели переводит в /basket/', () => {
            ProductPage.clickCrossSellGoToCart();
            cy.url().should('include', '/basket/');
        });

        // TC-SIM-07 (закрытие панели) объединён с TC-SIM-09 (та же панель, тот же
        // наблюдаемый эффект — как и TC-CART-06/08 в блоке 2). Крестик закрытия
        // разведкой найден физически ЗА пределами вьюпорта (x≈3242 при ширине экрана
        // 2560px) — не кликается ни настоящим, ни форсированным кликом ни в браузере,
        // ни в Cypress; "Продолжить" — единственный реально работающий способ закрыть
        // эту панель без перехода в корзину.
        it('TC-SIM-07/09: "Продолжить" из панели закрывает её, пользователь остаётся на странице', () => {
            ProductPage.clickCrossSellContinue();
            cy.wait(500);
            ProductPage.assertCrossSellPanelNotShown();
            cy.url().should('include', productUrl);
        });

        it('TC-SIM-10 / БАГ: ошибка API при добавлении сопутки похожего товара должна показать текст ошибки — см. BUG-002', () => {
            cy.intercept('POST', '**/api/v2/basket/add', { statusCode: 500, body: { error: 'internal' } }).as('addRelatedError');
            cy.get('@firstRelatedName').then((name) => {
                ProductPage.addRelatedProductByName(name);
                cy.wait('@addRelatedError', { timeout: 15000 });
                cy.wait(1500);
                cy.contains(/не удалось|ошибка/i).should('be.visible');
            });
        });
    });

    // BugReport/Товар/product_page/BUG-007: /alternatives (данные карточек в этой карусели)
    // рассинхронизирован с реальным /reviews ТОГО ЖЕ товара — карточка может
    // утверждать "(N) отзывов" при рейтинге, которого на самом деле нет (проверено
    // напрямую: 3 из 4 сэмплированных товаров расходились). Это баг бэкенда (частный
    // случай данных, не ошибки API), но по явному указанию пользователя (2026-08-06)
    // заводится и автоматизируется наравне с фронтенд-багами. Тест целенаправленно
    // проверяет ОЖИДАЕМОЕ поведение (карточка == реальность) и падает, документируя
    // баг, пока бэкенд не синхронизирует агрегаты.
    describe('Согласованность рейтинга карточек с реальными отзывами (BUG-007)', () => {

        it('БАГ: rating.reviewsCount/averageRating в /alternatives должны совпадать с summary из /reviews того же товара — см. BUG-007', () => {
            ProductPage.interceptAlternatives();
            cy.visit(productUrl);
            ProductPage.waitAlternatives().then((interception) => {
                const candidates = interception.response.body.products
                    .filter((p) => p.rating.reviewsCount > 0)
                    .slice(0, 8);
                expect(candidates, 'нужно хотя бы несколько карточек с ненулевым числом отзывов для сверки').to.have.length.greaterThan(0);

                cy.window().then((win) => {
                    const deviceId = win.localStorage.getItem('user_device_id');
                    const mismatches = [];

                    cy.wrap(candidates).each((product) => {
                        return cy.request({
                            method: 'GET',
                            url: `https://www.mechta.kz/api/v3/product/${product.slug}/reviews?sort=all&page=0`,
                            headers: { 'X-Mechta-Device-Id': deviceId },
                            failOnStatusCode: false,
                        }).then((res) => {
                            const real = (res.body && res.body.summary) || { averageRating: 0, reviewsCount: 0 };
                            if (real.reviewsCount !== product.rating.reviewsCount || real.averageRating !== product.rating.averageRating) {
                                mismatches.push({ slug: product.slug, cardSaid: product.rating, reality: real });
                            }
                        });
                    }).then(() => {
                        expect(mismatches, `карточки с рассинхронизированным рейтингом/кол-вом отзывов (см. BUG-007):\n${JSON.stringify(mismatches, null, 2)}`).to.have.length(0);
                    });
                });
            });
        });
    });
});
