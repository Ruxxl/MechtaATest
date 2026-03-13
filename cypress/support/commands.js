Cypress.Commands.add('login', () => {
    cy.request({
        method: 'POST',
        url: 'https://www.mechta.kz/api/v2/login', // Замените на URL вашего API
        body: {
            phone: '0000000001',
            sms_code: '0000',
        },
    }).then((response) => {
        expect(response.status).to.eq(200); // Убедитесь, что запрос успешен
    });
});