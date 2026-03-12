class checkout {

    auth_checkout() {

        cy.contains('p', 'Войти', {
                timeout: 20000
            })
            .first()
            .should('be.visible')
            .click();

        cy.get('#v-0-3', {
                timeout: 20000
            })
            .type('0000000000');

        cy.contains('button', 'Выслать код', {
                timeout: 20000
            })
            .first()
            .should('be.visible')
            .click();

        cy.wait(5000);

        cy.intercept('GET', '/api/v2/user').as('user');

        cy.get('input[aria-label="pin input 1 of 4"]', {
                timeout: 20000
            })
            .should('be.visible')
            .type('0000');


        cy.wait(3000)

        cy.wait('@user', ).then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
            const user_phone = interception.response.body.data.phone;
            const user_name = interception.response.body.data.full_name;

            expect(user_phone).to.equal('0000000000');
            expect(user_name.trim()).to.equal('John Appleseed');
        });


    }

    request_intercept() {

        cy.intercept('GET', '/api/v3/personal/delivery-addresses').as('delivery_addresses');
        cy.intercept('GET', '/api/v2/personal/card').as('card');
        cy.intercept('GET', '/api/v2/checkout?**').as('get_checkout');

    }

    step_one() {

        cy.wait('@get_checkout', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
            const user_phone = interception.response.body.data.person_types.individual.customer_data.phone.value;
            const user_name = interception.response.body.data.person_types.individual.customer_data.full_name.value;
            const user_email = interception.response.body.data.person_types.individual.customer_data.email.value;

            cy.wait(2000)

            cy.get('input[name="phone"]', {
                timeout: 20000
            }).invoke('val').then((val) => {
                // Убираем все не-цифры
                let digits = val.replace(/\D/g, '')
                // Отрезаем 7 (код страны)
                if (digits.length === 11 && digits.startsWith('7')) {
                    digits = digits.slice(1)
                }
                expect(digits).to.eq(user_phone)
            })

            cy.get('input[name="fio"]', {
                    timeout: 20000
                })
                .should('have.value', 'John Appleseed')

            cy.get('input[name="email"]', {
                    timeout: 20000
                })
                .should('have.value', user_email)
        })

        cy.get('button[type="button"]', {
                timeout: 20000
            }).contains('Далее')
            .click({
                force: true
            })

        cy.wait('@get_checkout', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
        })

    }

}

export default checkout;