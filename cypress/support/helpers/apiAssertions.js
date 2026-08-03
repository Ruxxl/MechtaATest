// Общие паттерны ожидания сетевых запросов, которые раньше были
// продублированы (с небольшими расхождениями) в home_page.js и product_page.js.

// Ждёт запрос, который бэкенд отправляет не всегда (например, для анонимной
// сессии без cy.login()). Если запроса не было — не роняем тест, а логируем.
export function waitOptional(alias, { timeout = 15000, expectedStatuses = [200] } = {}) {
    return cy.get(`@${alias}.all`, { timeout }).then((interceptions) => {
        if (interceptions.length === 0) {
            cy.log(`ℹ️ ${alias}: запрос не отправлен (ожидаемо для этого состояния)`);
            return;
        }
        expect(interceptions[0].response?.statusCode).to.be.oneOf(expectedStatuses);
        cy.log(`✅ ${alias}: ${interceptions[0].response?.statusCode}`);
    });
}

// Ждёт обязательный запрос и проверяет, что статус входит в список ожидаемых.
// Ничего не возвращает из .then() — на этом уже спотыкались: cy.log() внутри
// .then() ставит в очередь ещё одну cy-команду, и Cypress ругается
// "mixing up async and sync code", если после неё синхронно возвращать значение.
export function waitAndAssertStatus(alias, expectedStatuses = [200], options = {}) {
    cy.wait(`@${alias}`, { timeout: 15000, ...options }).then(({ response }) => {
        const status = response?.statusCode;
        expect(status).to.be.oneOf(expectedStatuses);
        cy.log(`✅ ${alias}: ${status}`);
    });
}

// Проверяет, что запрос с ошибочным статусом (4xx/5xx) не ломает страницу:
// нужный элемент (например, сообщение об ошибке) всё равно должен появиться.
export function assertErrorStatus(alias, expectedStatuses) {
    cy.wait(`@${alias}`).then(({ response }) => {
        expect(response?.statusCode).to.be.oneOf(expectedStatuses);
    });
}
