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
            const apiCategories = interception.response.body.categories;
            const apiCategoryNames = apiCategories.map(cat => cat.name.trim());


            cy.get('div[data-slot="container"]:visible')
                .first() // Берем первый из видимых контейнеров
                .within(() => {
                    // 2. Ищем элементы, исключая клоны слайдера (обычно у них есть спец. классы)
                    // Если это не поможет, используем проверку на уникальность через Set
                    cy.get('div[role="group"] p')
                        .then(($els) => {
                            const allTexts = [...$els].map(el => el.innerText.trim());

                            // Если слайдер наплодил клонов, превращаем массив в Set (уникальные значения)
                            // и обратно в массив
                            const uiCategoryNames = [...new Set(allTexts)];

                            // Теперь сравниваем
                            expect(uiCategoryNames.length).to.equal(
                                apiCategoryNames.length,
                                `После удаления дубликатов в UI осталось ${uiCategoryNames.length}, в API ${apiCategoryNames.length}`
                            );

                            expect(uiCategoryNames).to.deep.equal(apiCategoryNames);
                        });
                });

            // 1. Сначала выполняем все проверки структуры, которые мы написали ранее
            expect(body.categories).to.be.an('array').and.not.be.empty;

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
            expect(body.promotionTypes).to.be.an('array').and.not.be.empty;
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

            const apiData = interception.response.body.promotionTypes;

            // Проходим по каждому элементу, пришедшему из API
            apiData.forEach((promo) => {
                // Находим <a> по названию акции
                cy.contains('a[data-slot="base"]', promo.name)
                    .should('be.visible')
                    .find('span.text-mi-text-secondary')
                    .invoke('text')
                    .then((uiCountText) => {
                        const uiCount = parseInt(uiCountText.trim(), 10);

                        // Используем expect для проверки
                        expect(uiCount).to.equal(promo.count, `Количество для "${promo.name}" совпадает с API`);
                    });
            });
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

        cy.url().should('include', '?sortBy=expiring');

        cy.get('div.w-full')
            .contains('span[data-slot="label"]', 'Новые') // Ищет конкретный текст в конкретном слоте
            .should('be.visible')
            .click();

        cy.url().should('include', '?sortBy=new');
    }

    check_action_title() {

        cy.wait('@promotions').then((interception) => {
            const title_action = interception.response.body.promotions[0].title;

            const url_slug = interception.response.body.promotions[0].slug;

            cy.intercept('GET', `/api/v2/actions/${url_slug}`).as('actionDetail');

            cy.contains('h3', title_action, {
                    timeout: 20000
                })
                .should('be.visible')
                .click();

            cy.url({
                timeout: 20000
            }).should('include', url_slug);
        })
    }

    check_detail_action() {

        cy.wait('@promotions').then((interception) => {
            const title_action = interception.response.body.promotions[0].title;

            const url_slug = interception.response.body.promotions[0].slug;

            cy.intercept('GET', `/api/v2/actions/${url_slug}`).as('actionDetail');

            cy.contains('h3', title_action, {
                    timeout: 20000
                })
                .should('be.visible')
                .click();

            cy.url({
                timeout: 20000
            }).should('include', url_slug);

            cy.wait('@actionDetail').then(({
                response
            }) => {
                // Проверяем статус и соответствие имени одной цепочкой
                expect(response.statusCode).to.eq(200);
                expect(response.body.data.name).to.eq(title_action);
            });


            // 2. Идем в навигацию и забираем текст из последней крошки
            cy.get('nav[aria-label="breadcrumb"] [data-slot="list"] li', {
                    timeout: 20000
                })
                .last() // Берем последнюю li в списке
                .invoke('text')
                .then((text) => {
                    const cleanText = text.trim();

                    // 3. Сравниваем с заголовком из бэкенда
                    expect(cleanText, { timeout: 20000 }).to.equal(title_action);

                    // Для отладки, если хочешь увидеть результат в консоли Cypress
                    cy.log(`Найдено в крошках: ${cleanText}`);
                });
        })
    }
}
export default actionPage;