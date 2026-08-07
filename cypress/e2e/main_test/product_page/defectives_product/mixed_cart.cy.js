// Лист 16 "Корзина смешанные товары" (CART-001..016) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// ВАЖНО: план оперирует КОНКРЕТНЫМИ числами из старого скриншота
// (443990+1522990+... = 3 309 960 и т.д.) — это не воспроизводимо на текущих
// живых данных (тот же класс проблемы, что и PDP-014/CART-002 из старого
// снимка). Вместо конкретных сумм проверяем ОБЩУЮ ФОРМУЛУ на реальных
// текущих данных: Итого = Подытог - |Выгода|, что эквивалентно исходному
// намерению CART-002/003/005, не завязываясь на конкретные цифры.
//
// НЕ автоматизировано:
// - CART-004 (структура discount_breakdown при промокоде/бонусах) — нет
//   активного промокода для проверки, чисто гипотетический сценарий
// - CART-006 (фишки по MindBox-правилу для уцененных) — нет публичного
//   API для сверки бизнес-правила начисления, см. Sheet 6 MOCK-009
// - CART-008 (прямой API-запрос на quantity=2) — эндпоинт изменения
//   количества в корзине не задокументирован/не найден живой разведкой
// - CART-009: живой разведкой (2026-08-06/07) подтверждено — это НЕ баг.
//   "На витрине" и "Уценка" — НЕЗАВИСИМЫЕ бейджи: "На витрине" означает
//   единичный физический шоурум-экземпляр (stock=1, +/- заблокированы),
//   "Уценка" означает уценённую цену. Обычный (не уценённый) товар тоже
//   может быть "На витрине" сам по себе — см. существующую заметку в
//   products.json (fixtures.inStock тоже onlyShopwindow=true). План
//   ошибочно считал эти два понятия синонимами.
// - CART-010 (иконки на позициях корзины) — дублирует Sheet 12 (BTN-*),
//   там уже проверено, что toggle работает одинаково для обоих типов
// - CART-013/014 (сверка/мок ответа API корзины) — подтверждено ранее
//   (Sheet 7 PRICE-005/006/007/014): у /basket/ нет клиентского JSON API,
//   страница целиком на SSR, перехватывать/мокать нечего
// - CART-015 (релевантность аксессуаров) — субъективная оценка, не
//   формализуемая в assertion без списка "правильных" аксессуаров
// - CART-016 (оформление смешанной корзины) — проект не создаёт реальные
//   заказы; ограничение способа доставки для смешанной корзины само по
//   себе устарело (см. project_defectives_delivery_feature_change) и
//   требует уточнения у аналитика, как и указано в самом плане
import add_basket from '../../../../support/pageObjects/add_basket';
import { normalizePrice } from '../../../../support/helpers/textUtils';

const AddBasket = new add_basket();

// Общий класс-контейнер "белая карточка" переиспользуется на странице
// корзины сразу для 5 РАЗНЫХ блоков (сами позиции, карусель аксессуаров,
// программа лояльности, сайдбар с итогами) — живой разведкой через DOM
// подтверждено, что различить их можно только по содержимому:
// - реальная позиция корзины: содержит иконку удаления i-ph:trash
// - сайдбар с итогами: содержит текст кнопки "Оформить заказ"
// Также подтверждено: страница рендерит ПАРАЛЛЕЛЬНЫЕ mobile/desktop
// копии некоторых контролов (например степпера количества) — видна только
// одна из них по брейкпоинту, поэтому все клики/чтения по иконкам внутри
// карточки нужно скоуить через :visible
const CART_ITEM_CARD = '.rounded-mi-xl.bg-mi-brand-base-background';
const hasTrash = (el) => Cypress.$(el).find('[class*="i-ph:trash"]').length > 0;
const isSidebarSummary = (el) => el.textContent.includes('Оформить заказ');

// Читает "N товара", подытог, "Выгода" и "Итого" ТОЛЬКО из карточки
// сайдбара с итогами (см. CART_ITEM_CARD) — это единственное надёжное
// место с этими цифрами: заголовок страницы дублирует "N товара" без
// суммы, а mobile/desktop дублирование других блоков делает точечный
// cy.contains(...) по всей странице ненадёжным
function readSidebarTotals() {
    return cy.get(CART_ITEM_CARD).filter((i, el) => isSidebarSummary(el)).first().invoke('text').then((raw) => {
        const text = raw.replace(/\s+/g, ' ').trim();
        const countMatch = text.match(/(\d+)\s*товар/);
        const subtotalMatch = text.match(/\d+\s*товар[а-я]*\s*([\d\s]+?)\s*₸/);
        const benefitMatch = text.match(/Выгода\s*(-?[\d\s]+?)\s*₸/);
        const totalMatch = text.match(/Итого\s*([\d\s]+?)\s*₸/);
        return {
            count: countMatch ? parseInt(countMatch[1], 10) : null,
            subtotal: subtotalMatch ? parseInt(normalizePrice(subtotalMatch[1]), 10) : null,
            benefit: benefitMatch ? parseInt(normalizePrice(benefitMatch[1]), 10) : null,
            total: totalMatch ? parseInt(normalizePrice(totalMatch[1]), 10) : null,
        };
    });
}

describe('Уценённые товары: смешанная корзина (CART-001/002/003/005/007/011/012, представительный набор)', { testIsolation: false }, () => {

    let fixtures;
    let products;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
        cy.fixture('products').then((p) => { products = p; });
    });

    // Аналогично уже задокументированной гонке в add_basket.js
    // (addProductToBasketIfNeeded): немедленный переход на /basket/ после
    // клика "В корзину" иногда успевает произойти раньше, чем запрос
    // добавления долетит до бэкенда — явно ждём его перед навигацией
    const buildMixedCart = () => {
        AddBasket.emptyBasket();
        cy.visit(products.withDiscount.url);
        AddBasket.addProductToBasketIfNeeded();
        cy.visit(fixtures.defectiveUnit.url);
        // Известный несвязанный баг приложения (см. Sheet 9 DISP-013):
        // добавление в корзину иногда сопровождается unhandled promise
        // rejection "[object Response]" от постороннего виджета апсейла —
        // подавляем, чтобы не ронять тест из-за чужой ошибки
        cy.on('uncaught:exception', () => false);
        cy.get('#product-add-to-basket').should('be.visible').click();
        // Живой разведкой подтверждено: реальный POST на /api/v2/basket/add
        // ПРОИСХОДИТ (успех виден по смене текста кнопки), но
        // cy.intercept()/cy.wait() на него никогда не срабатывает (таймаут
        // "No request ever occurred" при заведомо верном паттерне) — похоже,
        // этот конкретный запрос не проходит через перехватываемый
        // Cypress'ом сетевой слой (возможно service worker). Вместо
        // ожидания сетевого запроса и/или транзитного тоста (который может
        // успеть исчезнуть) ждём ПОСТОЯННЫЙ UI-признак успеха — смену
        // текста кнопки на "В корзине"
        cy.get('#product-add-to-basket', { timeout: 20000 }).should('contain.text', 'В корзине');
        cy.dismissAccessoryUpsell();
        cy.visit('/basket/');
        cy.contains('Уценка').should('be.visible');
    };

    it('CART-001/002/003/005: "Итого" в сайдбаре точно равно "Подытог" минус |Выгода| для смешанной корзины (общая формула, без завязки на старые цифры плана)', () => {
        buildMixedCart();
        readSidebarTotals().then(({ count, subtotal, benefit, total }) => {
            expect(count, 'счётчик товаров должен быть найден').to.eq(2);
            expect(subtotal, 'подытог должен быть найден').to.be.a('number');
            expect(benefit, '"Выгода" должна быть найдена').to.be.a('number');
            expect(total, '"Итого" должно быть найдено').to.eq(subtotal - Math.abs(benefit));
        });
    });

    it('CART-007: у уцененной позиции кнопка "+" в степпере количества задизейблена — количество нельзя увеличить выше 1', () => {
        buildMixedCart();
        cy.contains('Уценка').parents(CART_ITEM_CARD).first().within(() => {
            cy.get('[class*="i-ph:plus"]').filter(':visible').closest('button').should('be.disabled');
            cy.get('[class*="i-ph:minus"]').filter(':visible').closest('button').should('be.disabled');
        });
    });

    it('CART-011: удаление уцененной позиции из смешанной корзины корректно пересчитывает счётчик товаров и "Итого"', () => {
        buildMixedCart();
        readSidebarTotals().then(({ count: countBefore, total: totalBefore }) => {
            cy.contains('Уценка').parents(CART_ITEM_CARD).first().within(() => {
                cy.get('[class*="i-ph:trash"]').filter(':visible').closest('button').click({ force: true });
            });
            cy.contains('Уценка').should('not.exist');
            readSidebarTotals().then(({ count: countAfter, total: totalAfter }) => {
                expect(countAfter, 'счётчик товаров должен уменьшиться на 1 после удаления').to.eq(countBefore - 1);
                expect(totalAfter, '"Итого" должно уменьшиться после удаления позиции').to.be.lessThan(totalBefore);
            });
        });
    });

    it('CART-012: увеличение количества ОБЫЧНОГО товара не изменяет количество/цену уцененной позиции рядом с ним', () => {
        buildMixedCart();
        cy.contains('Уценка').parents(CART_ITEM_CARD).first().invoke('text').then((defectiveCardTextBefore) => {
            cy.get(CART_ITEM_CARD)
                .filter((i, el) => hasTrash(el) && !el.textContent.includes('Уценка'))
                .first()
                .within(() => {
                    cy.get('[class*="i-ph:plus"]').filter(':visible').closest('button').click({ force: true });
                });
            cy.contains('Уценка').parents(CART_ITEM_CARD).first().invoke('text').should('eq', defectiveCardTextBefore);
        });
    });
});
