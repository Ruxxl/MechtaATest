// Лист 7 "Проверка цен (API)" (PRICE-001..016) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Подтверждено разведкой: и /catalog/products (список), и /product/{slug}
// (карточка), и /product/{slug}/defectives (модалка выбора) отдают
// prices.basePrice / prices.finalPrice (+ discount — абсолютная сумма в
// тенге, не отдельное поле процента; UI считает % сам:
// round((1-final/base)*100)).
//
// НЕ автоматизировано — нет отдельного клиентского API для корзины/чек-аута:
// - PRICE-005/006/007/014: корзина полностью рендерится через SSR, отдельного
//   клиентского GET /basket (или аналога) не существует — проверено (все
//   угаданные пути /api/v3/basket, /api/v3/cart и т.п. возвращают JSON-обёртку
//   "not_found" со статусом 200, а не реальные данные; в network-логе живой
//   /basket/ страницы клиентских XHR к корзине нет вообще). Сравнивать
//   "UI корзины" не с чем, кроме самого себя.
// - PRICE-010/015: требуют реального создания заказа для проверки серверной
//   ревалидации цены — вне сознательной границы проекta (см. заголовок
//   cart_and_checkout.cy.js)
// - PRICE-016: бонусы/фишки не имеют отдельного публичного поля для сверки
//   (значение "+N фишек" на карточке товара — chipsPromotion, но соответствие
//   именно формуле начисления в корзине не публикуется отдельно)
//
// ИЗВЕСТНАЯ НЕСТАБИЛЬНОСТЬ (после 8 циклов диагностики, см. сессию
// 2026-08-06): моки prices.finalPrice через cy.intercept на страницах
// PRICE-009/011/012/013 примерно в 10-20% прогонов "не подхватываются" —
// UI показывает реальную (немоканную) цену, хотя тот же техника (req.continue
// с изменением res.body) надёжно работает в других файлах (Sheet 2, Sheet 6).
// Испробовано и НЕ решило проблему полностью: cache-busting query-параметр,
// более точный regex-паттерн intercept (исключающий /description и другие
// подресурсы), смена фикстуры на другой физический экземпляр, cy.reload()
// после intercept. Какой именно из 4 тестов "плавает" — меняется от прогона
// к прогону без видимой связи с кодом теста — похоже на гонку между SSR-
// гидратацией Nuxt и моментом применения intercept, а не логическую ошибку
// теста. При случайном падении одного из PRICE-009/011/012/013 — перезапустить
// файл, не тратить время на дальнейшую диагностику этого конкретного паттерна.
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();
const DEVICE_HEADER = { 'X-Mechta-Device-Id': 'cypress-price-checks-test' };

function priceRegex(price) {
    return new RegExp(String(price).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'));
}

describe('Уценённые товары: проверка цен API (PRICE-001..004, 008, 009, 011..013)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('PRICE-001: цена карточки в списке уценённых товаров совпадает с API списка', () => {
        cy.request({ url: 'https://www.mechta.kz/api/v3/catalog/products?slug=defective-smartfony-i-gadjety', headers: DEVICE_HEADER }).then((response) => {
            const product = response.body.products[0];
            cy.visit(fixtures.defectivesSectionUrl.url);
            cy.contains(priceRegex(product.prices.finalPrice)).should('be.visible');
        });
    });

    it('PRICE-002: цены позиций в модалке "Выберите уцененный товар" совпадают с API /defectives, не перепутаны между собой', () => {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
        cy.visit(fixtures.regularWithDefectiveVariants.url);
        cy.wait('@defectives', { timeout: 20000 }).then((interception) => {
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            interception.response.body.defectives.forEach((item) => {
                // .should('exist'), не 'be.visible' — дублированный mobile/
                // desktop DOM, cy.contains() иногда попадает в скрытую копию
                cy.contains(priceRegex(item.prices.finalPrice)).should('exist');
            });
        });
    });

    it('PRICE-003: цена на странице конкретного уцененного товара совпадает с API карточки', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            cy.contains(priceRegex(interception.response.body.prices.finalPrice)).should('be.visible');
        });
    });

    it('PRICE-004: старая (зачёркнутая) цена и новая цена на странице товара соответствуют basePrice/finalPrice из API', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { basePrice, finalPrice } = interception.response.body.prices;
            cy.contains(priceRegex(finalPrice)).should('be.visible');
            cy.contains(priceRegex(basePrice)).should('be.visible');
        });
    });

    it('PRICE-008: цена позиции в "Деталях заказа" зафиксирована на момент покупки и не меняется на текущую', () => {
        cy.login();
        cy.visit('/cabinet/payment/10394121/');
        // Заказ реальный, оформлен ранее — цена в заказе (5391₸/995₸ по
        // разведке) должна остаться зафиксированной вне зависимости от
        // текущей цены этих же товаров в каталоге
        cy.contains(/5[\s ]?391/).should('be.visible');
        cy.contains(/995/).should('be.visible');
    });

    it('PRICE-009: цена на карточке товара актуальна на момент открытия, а не устаревшая из списка (мок изменения цены)', () => {
        cy.intercept('GET', /\/api\/v3\/product\/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v\/?(\?|$)/, (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = 700000;
                res.body.prices.basePrice = 750000;
            });
        }).as('productNewPrice');
        // Разведкой подтверждено: повторный визит на URL, уже посещённый
        // ранее в этом файле, иногда обслуживается из HTTP-кеша без
        // реального сетевого запроса — мок тогда не срабатывает.
        // Cache-busting query-параметр гарантирует свежий запрос
        cy.visit(`${fixtures.defectiveUnit.url}?_cb=${Date.now()}`);
        cy.wait('@productNewPrice', { timeout: 20000 });
        cy.contains(priceRegex(700000)).should('be.visible');
        cy.contains(priceRegex(809955)).should('not.exist');
    });

    it('PRICE-011: price=null в ответе API — UI не должен показывать "0 ₸"/пустую цену как валидную', () => {
        cy.intercept('GET', /\/api\/v3\/product\/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v\/?(\?|$)/, (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = null;
                res.body.prices.basePrice = null;
            });
        }).as('productNullPrice');
        cy.visit(`${fixtures.defectiveUnit.url}?_cb=${Date.now()}`);
        cy.wait('@productNullPrice', { timeout: 20000 });
        cy.contains(/\b0[\s ]?₸/).should('not.exist');
    });

    it('PRICE-012: отрицательная цена в ответе API — UI не должен показывать отрицательное значение', () => {
        cy.intercept('GET', /\/api\/v3\/product\/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v\/?(\?|$)/, (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = -5000;
            });
        }).as('productNegativePrice');
        cy.visit(`${fixtures.defectiveUnit.url}?_cb=${Date.now()}`);
        cy.wait('@productNegativePrice', { timeout: 20000 });
        cy.contains(priceRegex(809955)).should('not.exist');
        cy.contains(/-5[\s ]?000/).should('not.exist');
    });

    it('PRICE-013: при рассинхроне цены между списком и карточкой (мок) на карточке используется цена карточки, а не списка', () => {
        cy.intercept('GET', /\/api\/v3\/product\/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v\/?(\?|$)/, (req) => {
            req.continue((res) => {
                res.body.prices.finalPrice = 95000;
            });
        }).as('productCardPrice');
        cy.visit(`${fixtures.defectiveUnit.url}?_cb=${Date.now()}`);
        cy.wait('@productCardPrice', { timeout: 20000 });
        cy.contains(priceRegex(95000)).should('be.visible');
        cy.contains(priceRegex(809955)).should('not.exist');
    });
});
