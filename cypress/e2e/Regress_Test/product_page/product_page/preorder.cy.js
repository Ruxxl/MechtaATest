// TC-PREORDER-01/02 из Mechta_ProductPage_TestCases.xlsx: предзаказ.
// Разведка 2026-08-05: живой товар с preorder != null найден через
// GET /api/v3/catalog/products?slug=smartfony&orderBy=sort&pageSize=100&promotion=
// (постранично) — фильтр по products[].preorder. У товара с availability='preorder'
// вместо "В корзину"/"Купить сейчас" — ЕДИНСТВЕННАЯ кнопка "Предзаказ" (иконка
// календаря, без стабильного id — селектор по тексту). Клик для анонимной сессии
// показывает ТУ ЖЕ модалку логина "Личный кабинет", что и "Купить сейчас"/"Оформить
// заказ" везде в проекте — НЕ прямой переход на страницу оформления заказа, вопреки
// формулировке плана (тот же паттерн, что уже задокументирован для TC-CART-09/
// TC-INFO-19). Окно предзаказа истекает 17.08.2026 — если протухнет, см. заметку
// в fixtures/products.json -> preorder про поиск нового живого примера.
import { assertLoginModalShown } from '../../../../support/helpers/authModal';

describe('Страница товара: предзаказ (TC-PREORDER-01/02)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.preorder.url; });
    });

    it('ПОЗИТИВ: товар в статусе предзаказа показывает кнопку "Предзаказ" вместо обычных кнопок покупки, подтверждено API', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(productUrl);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            expect(interception.response.body.availability, 'фикстура должна быть в статусе preorder').to.eq('preorder');
            expect(interception.response.body.preorder, 'фикстура должна иметь непустой объект preorder').to.exist;

            cy.contains('button', 'Предзаказ').should('be.visible');
            cy.get('#product-add-to-basket').should('not.exist');
            cy.get('#product-buy-now').should('not.exist');
        });
    });

    it('TC-PREORDER-01 (уточнено разведкой): клик "Предзаказ" для анонимного пользователя показывает модалку логина, а не переход на чекаут', () => {
        cy.visit(productUrl);
        cy.contains('button', 'Предзаказ').click();
        assertLoginModalShown();
        cy.url().should('include', '/product/');
    });

    // TC-PREORDER-02 буквально ("ошибка перехода при недоступном роуте чекаута") не
    // воспроизводим для анонимной сессии — модалка логина показывается ДО какого-либо
    // запроса к чекауту (тот же паттерн, что и TC-CART-10/TC-BONUS-03). Проверяем
    // соседний инвариант: кнопка остаётся рабочей и повторно открывает модалку
    it('НЕГАТИВ (аналог TC-PREORDER-02): повторный клик "Предзаказ" после закрытия модалки снова показывает модалку логина, кнопка не ломается', () => {
        cy.visit(productUrl);
        cy.contains('button', 'Предзаказ').click();
        assertLoginModalShown();
        cy.get('body').type('{esc}');
        cy.contains('button', 'Предзаказ').should('be.visible').click();
        assertLoginModalShown();
    });
});
