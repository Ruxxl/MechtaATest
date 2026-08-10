// Новое поле "Артикул" на странице товара (добавлено на сайте, разведка
// 2026-08-10). Блок характеристик (#product-property) теперь начинается со
// строки "Артикул" ПЕРЕД Брендом — из-за этого все id
// product-characteristic-key/value-N сдвинулись на +1, см. комментарий в
// cypress/support/pageObjects/product_page.js -> selectors.
//
// Разведка (прямой обход DOM + подмена /product ответа через cy.intercept):
// - Артикул НЕ отдельное поле в mainProperties[] из /product/{slug} (тот массив
//   как был из 6 записей без Артикула, так и остался) — это производное от
//   корневого поля `code` ("17200019974" -> отображается "19974").
// - Трансформация — code.slice(6) (отбросить первые 6 символов), а НЕ
//   "последние 5 символов": на реальных данных code всегда 11 символов, и обе
//   формулы дают одинаковый результат, поэтому разница проявляется только на
//   коротком code. Подтверждено моком: code="123" (короче 6 символов) →
//   отображается "" (пусто) — ровно то, что даёт code.slice(6) на "123", а НЕ
//   "123", что дала бы .slice(-5). Использовать в тестах именно .slice(6).
// - В /properties (панель "Все характеристики") "Артикул" тоже присутствует, но
//   там лежит СЫРОЕ значение code без обрезки — сама панель, тем не менее,
//   рендерит его тем же обрезанным способом, что и главный блок (подтверждено
//   прямым обходом DOM) — то есть трансформация применяется на фронте в обоих
//   местах, а не только в одном.
// - code отсутствует в ответе → строка "Артикул" вообще не рендерится (а не
//   рендерится с пустым/undefined значением) — фронт корректно скрывает блок.
import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: поле "Артикул" (новое покрытие)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.onlyShopwindow.url; });
    });

    it('ПОЗИТИВ: значение Артикул совпадает с code.slice(6) из /product/{slug}', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        ProductPage.check_article();
    });

    it('ПОЗИТИВ: "Артикул" — первая строка блока характеристик, перед "Бренд"', () => {
        cy.visit(productUrl);
        cy.get('[id^="product-characteristic-key-"]').then(($els) => {
            const texts = [...$els].map((el) => el.textContent.trim());
            expect(texts[0], 'первая строка блока характеристик').to.eq('Артикул');
            expect(texts[1], 'вторая строка блока характеристик').to.eq('Бренд');
        });
    });

    it('ПОЗИТИВ: копирование артикула — тост "Артикул товара скопирован"', () => {
        cy.visit(productUrl);
        ProductPage.check_article_copy_button();
    });

    it('ПОЗИТИВ (внутренняя согласованность): значение Артикул в главном блоке и в панели "Все характеристики" совпадает', () => {
        cy.visit(productUrl);
        ProductPage.articleValue.invoke('text').then((mainBlockValue) => {
            expect(mainBlockValue, 'на главном блоке значение не должно быть пустым').to.not.be.empty;

            ProductPage.openCharacteristicsPanel();
            cy.get('[role="dialog"]').should('be.visible').within(() => {
                cy.contains('Артикул')
                    .parent()
                    .find('p')
                    .invoke('text')
                    .should('eq', mainBlockValue);
            });
        });
    });

    it('ПОЗИТИВ (сверка с API): сырое значение "Артикул" в /properties равно полному code из /product (обрезка — только на фронте)', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@product', { timeout: 20000 }).then((productInterception) => {
            const { code } = productInterception.response.body;

            cy.wait('@properties', { timeout: 20000 }).then((propertiesInterception) => {
                const groups = propertiesInterception.response.body;
                const allProps = groups.flatMap((g) => g.properties);
                const articleProp = allProps.find((p) => p.name === 'Артикул');

                expect(articleProp, '/properties должен содержать поле "Артикул"').to.exist;
                expect(articleProp.value, 'сырое значение /properties.Артикул должно совпадать с /product.code').to.eq(code);
            });
        });
    });

    it('НЕГАТИВ (мок API): короткий code (< 6 символов) — строка "Артикул" рендерится с пустым значением, страница не ломается', () => {
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                res.body.code = '123';
            });
        }).as('shortCodeProduct');
        cy.visit(productUrl);
        cy.wait('@shortCodeProduct', { timeout: 20000 });

        cy.get('#product-characteristic-key-1').should('have.text', 'Артикул');
        ProductPage.articleValue.should('have.text', '');
        cy.get('#product-add-to-basket').should('be.visible');
    });

    it('НЕГАТИВ (мок API): code отсутствует в ответе — строка "Артикул" не рендерится вовсе, страница не ломается', () => {
        cy.intercept('GET', '**/api/v3/product/*', (req) => {
            req.continue((res) => {
                delete res.body.code;
            });
        }).as('noCodeProduct');
        cy.visit(productUrl);
        cy.wait('@noCodeProduct', { timeout: 20000 });

        cy.get('#product-characteristic-key-1').should('not.exist');
        cy.get('#product-add-to-basket').should('be.visible');
    });
});
