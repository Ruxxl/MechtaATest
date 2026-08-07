// Блок 1 из Mechta_ProductPage_TestCases.xlsx: панель "Все характеристики"
// (TC-INFO-17..20, 23). Разведка 2026-08-04: панель — это role="dialog" со
// сгруппированными характеристиками (те же группы/поля, что в /properties),
// дисклеймером сверху и ценой + кнопками "Купить сейчас"/"В корзину" снизу. Кнопки
// покупки внутри дублируют id (#product-add-to-basket и т.д.) с кнопками на
// странице позади панели — клики скоупятся строго внутри диалога.
import productPage from '../../../../support/pageObjects/product_page';
import { normalizePrice } from '../../../../support/helpers/textUtils';
import { assertLoginModalShown } from '../../../../support/helpers/authModal';

const ProductPage = new productPage();

describe('Страница товара: панель "Все характеристики" (TC-INFO-17..20, 23)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.onlyShopwindow.url; });
    });

    it('TC-INFO-17: открытие панели — группы и поля совпадают с /properties из API', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@properties', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const groups = interception.response.body;
            expect(groups, 'фикстура должна иметь несколько групп характеристик').to.have.length.greaterThan(1);

            // Часть групп в /properties приходит ПУСТОЙ (properties: []) — например
            // "Обогрев"/"Охлаждение"/"Электропитание" у этого товара — фронт корректно
            // их не рендерит, это не баг, а ожидаемое поведение (нет данных — нет блока)
            const nonEmptyGroups = groups.filter((g) => g.properties.length > 0);
            expect(nonEmptyGroups, 'фикстура должна иметь хотя бы одну непустую группу').to.have.length.greaterThan(0);

            ProductPage.openCharacteristicsPanel();
            // Панель длинная и скроллится ПОД липким футером (цена/кнопки покупки) —
            // строки внизу списка формально "не видимы" (перекрыты футером), пока их
            // не проскроллить, поэтому проверяем наличие в DOM (exist), а не be.visible
            cy.get('[role="dialog"]').should('be.visible').within(() => {
                nonEmptyGroups.forEach((group) => {
                    cy.contains(group.name).should('exist');
                    group.properties.forEach((prop) => {
                        cy.contains(prop.name).should('exist');
                    });
                });
            });
        });
    });

    it('ПОЗИТИВ: цена в панели совпадает с finalPrice из /product/{slug}', () => {
        ProductPage.interceptRequests();
        cy.visit(productUrl);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { finalPrice } = interception.response.body.prices;
            ProductPage.openCharacteristicsPanel();
            // Отображаемая цена использует NBSP как разделитель разрядов, а не
            // обычный пробел — сравниваем через normalizePrice, а не substring-поиск
            cy.get('[role="dialog"]').invoke('text').then((text) => {
                expect(normalizePrice(text)).to.include(String(finalPrice));
            });
        });
    });

    it('TC-INFO-18: "В корзину" из панели характеристик реально добавляет товар — сверка через /basket/', () => {
        cy.visit(productUrl);
        ProductPage.openCharacteristicsPanel();
        ProductPage.interceptAddToBasket();
        ProductPage.clickPanelBuyButton('В корзину');
        ProductPage.waitAddToBasket();
        cy.visit('/basket/');
        cy.contains('1 товар').should('be.visible');
        cy.get('body').then(($body) => {
            const trash = $body.find('[class*="i-ph:trash"]');
            if (trash.length) cy.wrap(trash.first()).click();
        });
    });

    it('TC-INFO-19 (уточнено разведкой): "Купить сейчас" из панели для АНОНИМНОГО пользователя показывает модалку логина, а не чекаут напрямую', () => {
        // Разведка 2026-08-04: вопреки формулировке исходного файла ("переход на
        // чекаут"), для неавторизованной сессии сайт показывает модалку
        // "Личный кабинет" (номер телефона) — это уже задокументированное и
        // протестированное в проекте поведение, см.
        // add_basket.js -> clickCheckoutAnonymously()/assertLoginModalShown().
        // Прямого перехода на /checkout для анонимного пользователя не происходит.
        cy.visit(productUrl);
        ProductPage.openCharacteristicsPanel();
        ProductPage.clickPanelBuyButton('Купить сейчас');
        assertLoginModalShown();
    });

    it('TC-INFO-23: панель закрывается по клику на крестик', () => {
        cy.visit(productUrl);
        ProductPage.openCharacteristicsPanel();
        cy.get('[role="dialog"]').should('be.visible');
        ProductPage.closeCharacteristicsPanel();
        cy.get('[role="dialog"]').should('not.exist');
    });

    it('НЕСТАНДАРТНЫЙ: панель закрывается по Esc', () => {
        cy.visit(productUrl);
        ProductPage.openCharacteristicsPanel();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('body').type('{esc}');
        cy.get('[role="dialog"]').should('not.exist');
    });

    it('НЕГАТИВ: товар без данных /properties — панель/кнопка "Все характеристики" не ломает страницу', () => {
        cy.intercept('GET', '**/api/v3/product/*/properties', { statusCode: 200, body: [] }).as('emptyProperties');
        cy.visit(productUrl);
        cy.wait('@emptyProperties');
        cy.get('#product-add-to-basket').should('be.visible');
    });
});
