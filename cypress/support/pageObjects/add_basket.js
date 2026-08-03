import { assertLoginModalShown } from '../helpers/authModal';

class add_basket {
    numericId = null;


    intercept_request() {
        cy.intercept('POST', '**/api/v2/basket/add').as('add_basket_request'); //Добавление товара в корзину
        cy.intercept('GET', '**/api/v2/basket').as('get_basket_request'); //Получение данных корзины после добавления товара
        cy.intercept('GET', '**/api/v3/product/*').as('getProduct');
    }

    getProduct() {
        cy.wait('@getProduct').then((interception) => {
            this.numericId = interception.response.body.numericId;
            cy.log(`Product ID: ${this.numericId}`);
        });
    }

    check_intercept() {
        // ✅ Проверка add
        cy.wait('@add_basket_request').then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            cy.log('REQUEST ADD BASKET:', interception.request.body);
            expect(interception.request.body.product_id).to.eq(this.numericId);
            expect(interception.response.body.result)
                .to.eq(true);
        });

        // ✅ Проверка basket
        cy.wait('@get_basket_request').then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const apiName = interception.response.body.data.items[0].name; // название из API

            // Берём текст с h1
            cy.get('h1.pt-2\\!.pr-0\\!').invoke('text').then((pageText) => {
                // Сравниваем
                expect(pageText.trim()).to.eq(apiName);
            })

            cy.log('REQUEST GET BASKET:', interception.response.body.data.items[0].product_id);

            expect(interception.response.body.data.items[0].product_id).to.eq(this.numericId);

        });
    }

    // --- Негативные кейсы ---

    // Добавляет товар в корзину со страницы товара, если он ещё не добавлен,
    // и ЖДЁТ ответа API перед тем, как отдать управление дальше — без этого
    // немедленный переход на /basket иногда успевал произойти раньше, чем
    // запрос добавления в корзину долетал до бэкенда, и корзина оставалась пустой
    addProductToBasketIfNeeded() {
        cy.get('body').then(($body) => {
            if ($body.find('button:contains("В корзину")').length === 0) {
                return;
            }
            cy.intercept('POST', '**/api/v2/basket/add').as('addToBasketNegativeFlow');
            cy.get('#product-add-to-basket').click({ force: true });
            cy.wait('@addToBasketNegativeFlow', { timeout: 20000 });
            cy.dismissAccessoryUpsell();
        });
    }

    // Корзина в этом окружении привязана к cookie гостя, которая переживает
    // cy.session между тестами (сама сессия ресторит только куки/сторадж,
    // а не серверные данные) — поэтому перед проверкой пустого состояния
    // явно вычищаем корзину, а не полагаемся на то, что она "и так пустая"
    emptyBasket() {
        cy.visit('/basket');
        const removeNext = () => {
            cy.get('body').then(($body) => {
                if ($body.find('[class*="i-ph:trash"]').length === 0) {
                    return;
                }
                cy.get('[class*="i-ph:trash"]').first().closest('button').click({ force: true });
                cy.wait(500);
                removeNext();
            });
        };
        removeNext();
    }

    // Пустая корзина: сайт делает редирект на отдельный URL /empty-basket/
    // (не просто рендерит пустой список на /basket/), поэтому проверяем именно это
    assertEmptyBasketState() {
        cy.url().should('include', '/empty-basket');
        cy.contains('h1', 'Корзина пуста').should('be.visible');
        // Это ссылка <a href="/">, а не <button>
        cy.contains('a', 'Продолжить покупки').should('be.visible');
    }

    // Количество товара не может быть меньше 1: кнопка "-" (иконка i-ph:minus)
    // на бэкенде уже приходит с атрибутом disabled при количестве 1, а не просто
    // визуально приглушена, поэтому клик по ней не должен ничего менять
    assertQuantityCannotGoBelowOne() {
        cy.get('[class*="i-ph:minus"]').first().closest('button').should('be.disabled');
    }

    // Попытка оформить заказ из корзины без авторизации: сайт НЕ редиректит
    // на главную (как прямой заход на /checkout/), а показывает модалку логина
    clickCheckoutAnonymously() {
        cy.contains('button', 'Оформить заказ').should('be.visible').click();
        assertLoginModalShown();
    }
}

export default add_basket;