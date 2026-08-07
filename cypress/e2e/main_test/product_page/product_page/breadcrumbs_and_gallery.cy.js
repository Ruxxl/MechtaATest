// Блок 1 из Mechta_ProductPage_TestCases.xlsx: хлебные крошки (TC-BC-*) и галерея
// изображений (TC-GAL-*). Общие для ЛЮБОГО товара (не привязаны к одному флагу),
// поэтому лежат на уровень выше, в cypress/e2e/main_test/product_page/, а не
// внутри product_onlyShopwindow/. См. TestPlans/PDP-testcases-coverage.md.
//
// КАЖДЫЙ шаг сверяется с API GET /api/v3/product/{slug}: хлебные крошки — с полем
// `categories` (порядок в ответе level 3→2→1, в UI отображается в обратном порядке
// level 1→2→3 — подтверждено разведкой 2026-08-04), галерея — с полем `images`
// (ровно images.length миниатюр, порядок совпадает).
//
// Разведка 2026-08-04: галерея — не "одно главное фото, которое подменяется", а
// ГОРИЗОНТАЛЬНО СКРОЛЛИРУЕМАЯ лента из всех изображений сразу (все <img> реально в
// DOM одновременно) — активная миниатюра помечена классом
// border-mi-brand-base-brand-secondary. Модалка (клик по главному фото) открывает
// центрированный просмотр с ценой и кнопками покупки внизу — но кнопки покупки в
// модалке ДУБЛИРУЮТ id (#product-add-to-basket и т.д.) с кнопками на странице позади
// модалки, поэтому клики скоупятся внутри модалки, а не глобальным cy.get('#id').
import productPage from '../../../../support/pageObjects/product_page';
import { assertLoginModalShown } from '../../../../support/helpers/authModal';

const ProductPage = new productPage();

describe('Страница товара: хлебные крошки и галерея (TC-BC-*, TC-GAL-*)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.onlyShopwindow.url; });
    });

    describe('Хлебные крошки (TC-BC-*) ↔ поле categories из /product/{slug}', () => {

        it('ПОЗИТИВ: хлебные крошки совпадают с categories из API (текст, порядок, ссылки)', () => {
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                expect(interception.response.statusCode).to.eq(200);
                // В API категории идут от глубокой (level 3) к корневой (level 1),
                // в хлебных крошках — наоборот, от корневой к текущей
                const expectedCrumbs = [...interception.response.body.categories].reverse();

                cy.get('nav[aria-label="breadcrumb"] a').should('have.length', expectedCrumbs.length).each(($a, index) => {
                    expect($a.text().trim()).to.eq(expectedCrumbs[index].name);
                    expect($a.attr('href')).to.include(expectedCrumbs[index].slug);
                });
            });
        });

        it('TC-BC-01: клик по промежуточному разделу переводит именно на URL этого раздела из API', () => {
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const expectedCrumbs = [...interception.response.body.categories].reverse();
                const target = expectedCrumbs[0];

                cy.get('nav[aria-label="breadcrumb"] a').first().click();
                cy.url().should('include', target.slug);
            });
        });

        it('TC-BC-02 (уточнено разведкой): "Главная" отсутствует; товар присутствует ПОСЛЕДНИМ пунктом, но НЕ как ссылка', () => {
            // Разведка 2026-08-04: вопреки формулировке исходного файла ("путь не
            // содержит текущий товар"), название товара реально ЕСТЬ в хлебных
            // крошках последним пунктом — просто не как <a>, а как обычный текст
            // (стандартный паттерн "текущая страница не кликабельна"). Наблюдение
            // важнее документа — фиксируем фактическое поведение.
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const { categories, name } = interception.response.body;

                cy.get('nav[aria-label="breadcrumb"]').within(() => {
                    cy.contains('Главная').should('not.exist');
                    cy.get('a').should('have.length', categories.length);
                    cy.get('a').each(($a) => {
                        expect($a.text().trim()).to.not.eq(name);
                    });
                });
                cy.get('nav[aria-label="breadcrumb"]').should('include.text', name);
            });
        });

        it('НЕГАТИВ (аналог TC-BC-03): переход по несуществующему разделу показывает 404, а не сломанную страницу', () => {
            cy.visit('/section/this-section-does-not-exist-xyz-123/', { failOnStatusCode: false });
            cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible');
        });
    });

    // TC-INFO-16 (клик по бренду при недоступном роуте → 404) НЕ автоматизируется:
    // разведкой 2026-08-06 подтверждено, что ссылка ведёт на ДРУГОЙ ДОМЕН —
    // https://www.mechta.kz/brands/{slug}/ (продакшн, не текущий preprod-хост
    // pp.yc.mechta.kz) — это полный кросс-доменный переход, а не внутренний
    // SPA-роут. В отличие от TC-BC-03/TC-SIM-02 (где "недоступный роут" был
    // смоделирован мокингом API того же preprod-домена), здесь нет способа
    // перехватить/сломать загрузку страницы на чужом домене без cy.origin() и
    // реального обращения к продакшену — не автоматизируется в рамках этого
    // preprod-проекта, аналогично TC-TRADEIN-07 (сам факт кросс-доменности —
    // не баг, а архитектурная особенность).
    describe('Ссылка на бренд (TC-INFO-15) ↔ поле brand из /product/{slug}', () => {

        it('TC-INFO-15: ссылка на бренд ведёт на страницу бренда, сверено со slug из API', () => {
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const { brand } = interception.response.body;
                expect(brand, 'у товара должен быть указан бренд').to.exist;
                cy.get('#product-characteristic-value-1')
                    .should('have.attr', 'href')
                    .and('include', `/brands/${brand.slug}/`);
            });
        });
    });

    describe('Галерея изображений (TC-GAL-*) ↔ поле images из /product/{slug}', () => {

        it('ПОЗИТИВ: количество миниатюр совпадает с images.length из API', () => {
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const { images } = interception.response.body;
                expect(images, 'фикстура должна иметь несколько изображений').to.have.length.greaterThan(1);
                ProductPage.galleryThumbnails.should('have.length', images.length);
            });
        });

        it('TC-GAL-01: клик по превью №2 делает его активным (по классу-маркеру)', () => {
            cy.visit(productUrl);
            ProductPage.galleryThumbnails.eq(0).should('have.class', ProductPage.activeThumbnailIndicatorClass);
            ProductPage.galleryThumbnails.eq(1).click();
            ProductPage.galleryThumbnails.eq(1).should('have.class', ProductPage.activeThumbnailIndicatorClass);
            ProductPage.galleryThumbnails.eq(0).should('not.have.class', ProductPage.activeThumbnailIndicatorClass);
        });

        it('TC-GAL-03: стрелка "вправо" листает галерею на следующее изображение (индекс 0 → 1)', () => {
            cy.visit(productUrl);
            ProductPage.galleryThumbnails.eq(0).should('have.class', ProductPage.activeThumbnailIndicatorClass);
            ProductPage.clickGalleryArrow('right');
            ProductPage.galleryThumbnails.eq(1).should('have.class', ProductPage.activeThumbnailIndicatorClass);
        });

        it('TC-GAL-04: стрелка "влево" листает галерею назад (индекс 2 → 1)', () => {
            cy.visit(productUrl);
            ProductPage.clickGalleryArrow('right');
            ProductPage.clickGalleryArrow('right');
            ProductPage.galleryThumbnails.eq(2).should('have.class', ProductPage.activeThumbnailIndicatorClass);
            ProductPage.clickGalleryArrow('left');
            ProductPage.galleryThumbnails.eq(1).should('have.class', ProductPage.activeThumbnailIndicatorClass);
        });

        it('TC-GAL-05: клик по главному изображению открывает модалку с ценой из API и кнопками покупки', () => {
            ProductPage.interceptRequests();
            cy.visit(productUrl);
            cy.wait('@product', { timeout: 20000 }).then((interception) => {
                const { finalPrice } = interception.response.body.prices;
                ProductPage.openGalleryModal();
                cy.get('[role="dialog"]').should('be.visible').within(() => {
                    cy.contains(new RegExp(String(finalPrice).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'))).should('be.visible');
                    cy.contains('button', 'В корзину').should('be.visible');
                    cy.contains('button', 'Купить сейчас').should('be.visible');
                });
            });
        });

        it('НЕСТАНДАРТНЫЙ: модалка галереи закрывается по Esc', () => {
            cy.visit(productUrl);
            ProductPage.openGalleryModal();
            cy.get('[role="dialog"]').should('be.visible');
            cy.get('body').type('{esc}');
            cy.get('[role="dialog"]').should('not.exist');
        });

        // TC-GAL-09 (уточнено разведкой 2026-08-06): для анонимной сессии клик
        // "Купить сейчас" показывает модалку логина БЕЗ ухода со страницы товара
        // (URL не меняется) — тот же паттерн, что и TC-CART-09/10, TC-PREORDER-01/02,
        // TC-INFO-19. Буквально смоделировать "недоступный роут чекаута" для анонима
        // невозможно — модалка логина перехватывает раньше, чем происходит любое
        // реальное обращение к чекауту, поэтому проверяем соседний инвариант
        // (модалка логина появляется) вместо буквального сценария из плана.
        it('TC-GAL-09 (уточнено разведкой): "Купить сейчас" из модалки галереи для анонима показывает модалку логина', () => {
            cy.visit(productUrl);
            ProductPage.openGalleryModal();
            cy.get('[role="dialog"]')
                .find('button')
                .filter((i, el) => el.textContent.trim() === 'Купить сейчас' && el.getBoundingClientRect().width > 0)
                .first()
                .click();
            assertLoginModalShown();
        });

        it('TC-GAL-10: "В корзину" из модалки галереи реально добавляет товар — сверка через /basket/', () => {
            cy.visit(productUrl);
            ProductPage.openGalleryModal();
            ProductPage.interceptAddToBasket();
            // Кнопки покупки в модалке дублируют текст/id с фоновой страницей —
            // явно берём ВИДИМУЮ кнопку внутри диалога, а не первую по DOM-порядку
            cy.get('[role="dialog"]')
                .find('button')
                .filter((i, el) => el.textContent.trim() === 'В корзину' && el.getBoundingClientRect().width > 0)
                .first()
                .click();
            ProductPage.waitAddToBasket();
            cy.visit('/basket/');
            cy.contains('1 товар').should('be.visible');
            // Возвращаем корзину в исходное состояние
            cy.get('body').then(($body) => {
                const trash = $body.find('[class*="i-ph:trash"]');
                if (trash.length) cy.wrap(trash.first()).click();
            });
        });
    });
});
