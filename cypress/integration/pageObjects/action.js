class actionPage {
    // Selectors
    interceptRequests() {
        cy.intercept('POST', '/api/seo-resolve').as('seoResolve');
        cy.intercept('GET', '/api/v3/promotions').as('promotions');
    }

    checkRequests_after_visit() {
        cy.wait('@seoResolve', {
            timeout: 10000
        }).its('response.statusCode').should('eq', 200);

        cy.wait('@promotions').then((interception) => {
            const body = interception.response.body;

            // 1. Проверка основного списка акций (Promotions)
            expect(body.promotions).to.be.an('array')
                .and.to.have.length(body.meta.perPage); // Должно быть 10 элементов (как в perPage)

            const firstPromo = body.promotions[0];
            expect(firstPromo).to.have.all.keys(
                'title', 'slug', 'link', 'image', 'fromDate', 'toDate', 'previewText', 'daysBeforeExpiration'
            );
            expect(firstPromo.title).to.be.a('string').and.not.be.empty;

            // 2. Проверка типов акций (Promotion Types) — именно 7 штук
            expect(body.promotionTypes).to.be.an('array').and.not.be.empty; 

            // Проверяем, что у каждого типа есть нужные поля (code, count, name)
            body.promotionTypes.forEach((type) => {
                expect(type).to.have.all.keys('code', 'count', 'name');
                expect(type.count).to.be.a('number');
            });

            // 3. Проверка мета-данных (Pagination & Totals)
            expect(body.meta).to.include({
                currentPage: 1,
                perPage: 10
            });
            expect(body.meta.totalCount).to.be.a('number').and.be.at.least(1);

            // 4. Проверка категорий (Categories) — что они вообще пришли
            expect(body.categories).to.be.an('array').and.not.be.empty;
            expect(body.categories[0]).to.have.property('actionExist', true);
        });
    }

    check_category_in_action() {
        cy.wait('@promotions').then((interception) => {
            const body = interception.response.body;

            // 1. Сначала выполняем все проверки структуры, которые мы написали ранее
            expect(body.categories).to.be.an('array').and.not.be.empty;

            // 2. Достаем имя первой категории из API
            // В твоем JSON это "\u0421\u043c\u0430\u0440\u0442\u0444\u043e\u043d\u044b \u0438 \u0433\u0430\u0434\u0436\u0435\u0442\u044b"
            const firstCategoryName = body.categories[0].name;

            // 3. Сверяем: ищем элемент на странице, текст которого пришел из API
            cy.contains('p', firstCategoryName)
                .first()
                .should('be.visible');
        });
    }

    check_action_types() {

        cy.wait('@promotions').then((interception) => {
            const body = interception.response.body;
            const firstTypeName = body.promotionTypes[0].name;
            const secondTypeName = body.promotionTypes[1].name;
            const thirdTypeName = body.promotionTypes[2].name;
            const fourthTypeName = body.promotionTypes[3].name;
            const fifthTypeName = body.promotionTypes[4].name;
            const sixthTypeName = body.promotionTypes[5].name;
            const seventhTypeName = body.promotionTypes[6].name;

            const typesCount = interception.response.body.promotionTypes[0].count; // Ожидаем 28

            // 4. Проверка в DOM
            cy.contains('a[data-slot="base"]', 'Все') // Находим ссылку, содержащую "Все"
                .find('span.text-mi-text-secondary') // Ищем внутри неё span с числом
                .should('be.visible')
                .and('have.text', typesCount.toString()); // Сверяем текст с числом из API

            // 1. выполняем все проверки структуры, которые мы написали ранее
            expect(body.promotionTypes).to.have.length();
            cy.contains('div', firstTypeName)
                .first()
                .should('be.visible')
                .and('has.text', firstTypeName);
            cy.contains('div', secondTypeName)
                .first()
                .should('be.visible')
                .and('has.text', secondTypeName);
            cy.contains('div', thirdTypeName)
                .first()
                .should('be.visible')
                .and('has.text', thirdTypeName);
            cy.contains('div', fourthTypeName)
                .first()
                .should('be.visible')
                .and('has.text', fourthTypeName);
            cy.contains('div', fifthTypeName)
                .first()
                .should('be.visible')
                .and('has.text', fifthTypeName);
            cy.contains('div', sixthTypeName)
                .first()
                .should('be.visible')
                .and('has.text', sixthTypeName);
            cy.contains('div', seventhTypeName)
                .first()
                .should('be.visible')
                .and('has.text', seventhTypeName);
        })

    }

    check_sorting() {

        cy.get('div.w-full')
            .contains('span[data-slot="label"]', 'Новые') // Ищет конкретный текст в конкретном слоте
            .should('be.visible');

        cy.get('div.w-full')
            .contains('span[data-slot="label"]', 'Популярные акции') // Ищет конкретный текст в конкретном слоте
            .should('be.visible')
            .click();

        cy.url().should('include', '?sortBy=popularity');

        cy.get('div.w-full')
            .contains('span[data-slot="label"]', 'Скоро закончатся') // Ищет конкретный текст в конкретном слоте
            .should('be.visible')
            .click();

        cy.url().should('include', '?sortBy=popularity');

        cy.get('div.w-full')
            .contains('span[data-slot="label"]', 'Новые') // Ищет конкретный текст в конкретном слоте
            .should('be.visible')
            .click();

        cy.url().should('include', '?sortBy=new');
    }
}
export default actionPage;