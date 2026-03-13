class checkout {

    auth_checkout() {

        cy.intercept('GET', '/api/v2/user').as('user');

        cy.contains('p', 'Войти')
            .first()
            .should('be.visible')
            .click();

        cy.get('#v-0-3')
            .type('0000000001');

        cy.contains('button', 'Выслать код')
            .first()
            .should('be.visible')
            .click();

        cy.get('input[aria-label="pin input 1 of 4"]')
            .should('be.visible')
            .type('0000');

        cy.wait('@user').then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
            const user_phone = interception.response.body.data.phone;
            const user_name = interception.response.body.data.full_name;

            expect(user_phone).to.equal('0000000001');
            expect(user_name.trim()).to.equal('Vv Vv');
        });
    }

    request_intercept() {

        cy.intercept('GET', '/api/v3/personal/delivery-addresses').as('delivery_addresses');
        cy.intercept('GET', '/api/v2/personal/card').as('card');
        cy.intercept('GET', '/api/v2/checkout?**').as('get_checkout');

    }

    step_one() {

        cy.wait('@get_checkout').then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
            const {
                phone,
                email
            } = interception.response.body.data.person_types.individual.customer_data;
            const user_phone = phone.value;
            const user_email = email.value;

            cy.wait(1000)

            cy.get('input[name="phone"]').invoke('val').then((val) => {
                // Убираем все не-цифры
                let digits = val.replace(/\D/g, '')
                // Отрезаем 7 (код страны)
                if (digits.length === 11 && digits.startsWith('7')) {
                    digits = digits.slice(1)
                }
                expect(digits).to.eq(user_phone)
            })

            cy.get('input[name="fio"]')
                .should('have.value', 'Vv Vv')

            cy.get('input[name="email"]')
                .should('have.value', user_email)
        })

        cy.get('#person-button_desktop').should('be.exist').click();
    }

    step_two() {

        cy.wait(1000)
        // 1. Перехватываем данные из API
        cy.wait('@get_checkout').then(({
            response
        }) => {
            expect(response.statusCode).to.equal(200);
            const shopName = response.body.data.delivery_info.pickup.stores[0].shop_name;

            // Сохраняем имя магазина в переменную Cypress (alias)
            cy.wrap(shopName).as('targetShop');
        });

        // 2. Переключаемся на самовывоз
        // .should('be.visible') гарантирует, что элемент не просто есть в DOM, но и доступен юзеру
        cy.contains('h4', 'Самовывоз').should('be.exist').click({
            force: true
        });

        // 3. Открываем список магазинов
        // Вместо eq(1) лучше использовать более специфичный селектор, если возможно
        cy.get('input[name="shop"]').should('be.visible').click();

        // 4. Выбираем конкретный магазин из API
        cy.get('@targetShop').then((shopName) => {
            cy.get(`button[aria-label="${shopName}"]`)
                .should('be.visible')
                .click();
        });

        // 5. Подтверждаем и переходим дальше
        cy.contains('button', 'Заберу отсюда').should('be.visible').click();

        cy.get('#delivery-button_desktop').should('be.visible').click();

    }

    step_three() {

        cy.wait(1000)
        cy.wait('@get_checkout').then(({
            response
        }) => {
            expect(response.statusCode).to.equal(200);

            const variants = response.body.data.payment_info.variants;

            variants.forEach((variant, index) => {
                // Пропускаем 5-й индекс (шестой элемент в списке)
                if (index === 5) {
                    cy.log(`Пропускаем вариант: ${variant.name}`);
                    return; // Переходим к следующей итерации цикла
                }

                // Проверяем видимость всех остальных
                cy.contains('h4', variants[0].name).should('be.visible');

                // Создаем алиасы (если нужны)
                cy.wrap(variant.name).as(`variant_${index}`);
            });

            // Клик выносим ЗА пределы цикла, чтобы он сработал один раз
            // Проверяем, что в массиве вообще есть хотя бы два элемента

            cy.intercept('GET', '/api/v2/checkout?payment_info=%7B%22payment_id%22:4%7D&person_type=1').as('check_payment');


            cy.contains('h4', variants[1].name)
                .should('be.visible')
                .click();

            cy.wait('@check_payment').then((interception) => {

                expect(interception.response.statusCode).to.equal(200);

            });

            cy.contains('h4', variants[0].name)
                .should('be.visible')
                .click();


            const names = variants.map(v => v.name).join(', ');
            cy.log(`Найдено методов оплаты: ${names}`);
        });

        cy.get('#payment-button_desktop').should('be.visible').click();

        cy.contains('button', 'Подтвердить заказ').first().should('be.visible').click();

        cy.contains('div', 'Сканируйте и оплатите').should('be.visible');

    }
}

export default checkout