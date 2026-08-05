import productPage from '../../../../support/pageObjects/product_page';

const ProductPage = new productPage();

// Комбинаторное тестирование /shipment (todayDelivery × expressDelivery × pickupAvailable —
// 3 независимых булевых флага из ТЗ). Живых товаров под КАЖДУЮ из 8 комбинаций не
// найти, поэтому подменяем ответ /shipment через cy.intercept и смотрим, как фронт
// реагирует на КАЖДУЮ комбинацию — тот же приём, что уже использован в BUG-001 (Акции)
// для форсированного 500. /subdivisions не подменяем (оставляем реальный ответ) —
// нас интересует именно переключение блоков по булевым флагам, а не точное число
// магазинов.
//
// ВАЖНО (открытый вопрос из разведки 2026-08-04): #product-deliveries-1 на реальном
// товаре с expressDelivery=false содержит блок "Доставка, Завтра" — неясно, это
// ФИКСИРОВАННЫЙ id для обычной доставки, или ПОЗИЦИОННЫЙ (достаётся первому
// отрendered блоку). Кейсы ниже с expressDelivery=true проверяют это эмпирически.
describe('Страница товара: комбинации флагов /shipment (todayDelivery × expressDelivery × pickupAvailable)', () => {

    let productUrl;
    before(() => {
        cy.fixture('products').then((p) => { productUrl = p.onlyShopwindow.url; });
    });

    function stubShipment(overrides) {
        cy.intercept('GET', '**/api/v3/product/*/shipment', {
            statusCode: 200,
            body: { todayDelivery: false, expressDelivery: false, pickupAvailable: true, subdivisions: 3, ...overrides },
        }).as('shipmentStub');
    }

    beforeEach(() => {
        ProductPage.interceptRequests();
    });

    it('todayDelivery=true, expressDelivery=false, pickupAvailable=true — блок доставки показывает "Сегодня"', () => {
        stubShipment({ todayDelivery: true });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.contains('Доставка').parent().should('include.text', 'Сегодня');
        cy.get('#product-shops').should('be.visible');
    });

    it('todayDelivery=false, expressDelivery=false, pickupAvailable=true — блок доставки показывает "Завтра" (базовый живой случай)', () => {
        stubShipment({ todayDelivery: false });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.contains('Доставка').parent().should('include.text', 'Завтра');
    });

    it('expressDelivery=true — появляется блок "Экспресс доставка", обычная "Доставка" тоже остаётся видна', () => {
        stubShipment({ expressDelivery: true, todayDelivery: false });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.contains('Экспресс доставка').should('be.visible');
        cy.contains(/Доставка\s*,\s*(Сегодня|Завтра)/).should('be.visible');
        cy.get('#product-free-shipping').should('be.visible');
    });

    it('expressDelivery=false — блок "Экспресс доставка" отсутствует в DOM (не просто невидим)', () => {
        stubShipment({ expressDelivery: false });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.contains('Экспресс доставка').should('not.exist');
    });

    it('todayDelivery=true И expressDelivery=true одновременно — оба блока видны без конфликта разметки', () => {
        stubShipment({ todayDelivery: true, expressDelivery: true });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.contains('Экспресс доставка').should('be.visible');
        cy.contains('Доставка').parent().should('include.text', 'Сегодня');
        cy.get('#product-add-to-basket').should('be.visible'); // страница не сломалась
    });

    it('pickupAvailable=true — блок "Самовывоз из N магазинов" виден', () => {
        stubShipment({ pickupAvailable: true });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('#product-shops').should('be.visible').should('include.text', 'Самовывоз');
    });

    it('НЕГАТИВ: pickupAvailable=false — блок "Самовывоз" не отображается (а не просто с count=0)', () => {
        stubShipment({ pickupAvailable: false, subdivisions: 0 });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('#product-shops').should('not.exist');
    });

    it('ГРАНИЧНЫЙ / БАГ-КАНДИДАТ: все три флага false (нет ни доставки, ни самовывоза) — пользователю нужен явный сигнал, а не пустой блок', () => {
        // Ситуация "товар нельзя ни доставить, ни забрать самому" — крайний случай,
        // которого может не быть среди живых товаров, но фронт обязан как-то на
        // него отреагировать: показать сообщение о недоступности, а не оставить
        // блок "Способ доставки" пустым/без объяснения (см. критерий бага в skill —
        // фронт должен корректно обработать ЛЮБОЙ валидный ответ API, а не только
        // те комбинации, что реально встречаются сегодня)
        stubShipment({ todayDelivery: false, expressDelivery: false, pickupAvailable: false, subdivisions: 0 });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('#product-shops').should('not.exist');
        cy.contains('Экспресс доставка').should('not.exist');
        cy.contains(/недоступ|нет доставки|не удалось определить способ/i).should('be.visible');
    });

    it('НЕГАТИВ (форма ответа): /shipment отвечает 500 — страница не должна зависнуть/сломаться (аналог BUG-001)', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment', { statusCode: 500, body: {} }).as('shipmentError');
        cy.visit(productUrl);
        cy.wait('@shipmentError');
        cy.get('#product-add-to-basket', { timeout: 20000 }).should('be.visible');
        cy.get('body').should('not.contain.text', 'undefined').and('not.contain.text', 'NaN');
    });

    // --- "А что если значение придёт по-другому" — контракт нарушен САМИМ значением
    // поля (не структурой ответа целиком), но это тоже валидный кейс для проверки:
    // бэкенд может начать присылать не то, что ожидает фронт, и это не должно
    // проявляться как "undefined"/сломанная вёрстка

    it('НЕСТАНДАРТНЫЙ (противоречивые значения): pickupAvailable=true, но subdivisions=0 — блок не должен утверждать несуществующий самовывоз', () => {
        // Внутренне противоречивый, но СИНТАКСИЧЕСКИ валидный ответ: "самовывоз
        // доступен" и "0 магазинов" одновременно. Если фронт слепо доверяет
        // pickupAvailable и рисует блок "Самовывоз из 0 магазинов" — это ровно тот
        // класс бага, который просили ловить: фронт не смог правильно
        // интерпретировать формально валидный, но нелогичный ответ API
        stubShipment({ pickupAvailable: true, subdivisions: 0 });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('#product-shops').should(($el) => {
            if ($el.length) {
                expect($el.text(), 'блок не должен утверждать "0 магазинов"').to.not.include('0 магазин');
            }
        });
    });

    it('ГРАНИЧНЫЙ (некорректный тип): subdivisions приходит отрицательным числом — фронт не показывает отрицательное количество', () => {
        stubShipment({ pickupAvailable: true, subdivisions: -3 });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('body').should('not.contain.text', '-3');
    });

    it('ГРАНИЧНЫЙ (некорректный тип): булевы поля приходят строками ("true"/"false") вместо boolean', () => {
        // Реальный класс бага в JS: если фронт где-то делает `value === true`
        // вместо truthy-проверки, строка "false" (truthy!) включит блок, которого
        // быть не должно — так и проверяем: страница не падает и не ведёт себя
        // непредсказуемо на неожиданном, но JSON-валидном типе поля
        stubShipment({ todayDelivery: 'false', expressDelivery: 'true', pickupAvailable: 'true' });
        cy.visit(productUrl);
        cy.wait('@shipmentStub');
        cy.get('#product-add-to-basket').should('be.visible');
        cy.get('body').should('not.contain.text', 'undefined').and('not.contain.text', '[object');
    });

    it('НЕГАТИВ (отсутствующее поле): expressDelivery вообще отсутствует в ответе — трактуется как false, а не как ошибка', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment', {
            statusCode: 200,
            body: { todayDelivery: false, pickupAvailable: true, subdivisions: 3 }, // expressDelivery нет вообще
        }).as('shipmentMissingField');
        cy.visit(productUrl);
        cy.wait('@shipmentMissingField');
        cy.contains('Экспресс доставка').should('not.exist');
        cy.get('#product-add-to-basket').should('be.visible');
    });

    it('НЕГАТИВ (пустое тело): /shipment отвечает 200, но с пустым объектом {} — блок доставки не падает со скрытыми полями', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment', { statusCode: 200, body: {} }).as('shipmentEmpty');
        cy.visit(productUrl);
        cy.wait('@shipmentEmpty');
        cy.get('#product-add-to-basket').should('be.visible');
        cy.get('body').should('not.contain.text', 'undefined').and('not.contain.text', 'NaN');
    });
});
