class favorites {

    // Для анонимного пользователя список избранного не блокируется логином —
    // страница открывается и показывает собственное пустое состояние.
    // Подтверждено на preprod: заголовок — h2, кнопки — ссылки <a>, не <button>.
    assertAnonymousEmptyState() {
        cy.contains('h2', 'Пока избранных товаров нет').should('be.visible');
        cy.contains('a', 'Акции').should('be.visible');
        cy.contains('a', 'Выбрать товары').should('be.visible');
    }

    // Для авторизованного пользователя с непустым избранным показывается
    // заголовок и счётчик товаров. Точное число не проверяем — оно меняется
    // от прогона к прогону (аккаунт общий для всех тестов).
    assertAuthenticatedListVisible() {
        cy.contains('h1', 'Избранное').should('be.visible');
        cy.contains('p', /^\d+ товар/).should('be.visible');
    }
}

export default favorites;
