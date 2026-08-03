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
}

export default add_basket;