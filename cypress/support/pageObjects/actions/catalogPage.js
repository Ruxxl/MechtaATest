// Page Object для каталога акций (/useful/shares/).
// Селекторы подтверждены прямым исследованием реального preprod 2026-08-03.
class CatalogPage {

    visit(queryString = '') {
        cy.visit(`/useful/shares/${queryString}`);
    }

    interceptPromotions() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/promotions**').as('promotions');
    }

    waitPromotions() {
        return cy.wait('@promotions');
    }

    get categoryIcons() {
        // Иконки категорий — это <a>/<button> с текстом названия категории и картинкой внутри
        return cy.get('a,button').filter(':has(img)');
    }

    clickCategoryByName(name) {
        cy.contains('a,button', name).first().click();
    }

    clickTypeByName(name) {
        cy.contains('a', name).click();
    }

    assertTypeActive(name) {
        // У активного пункта "Виды акций" есть самостоятельный класс подсветки фона
        // "bg-mi-base-simple-hover!" (не только hover:-вариант, который есть у всех)
        cy.contains('a', name).invoke('attr', 'class').should('match', /(?:^|\s)bg-mi-base-simple-hover!(?:\s|$)/);
    }

    assertCategoryDisabled(name) {
        cy.contains('a,button', name).first().should('have.attr', 'aria-disabled', 'true');
    }

    assertCategoryEnabled(name) {
        cy.contains('a,button', name).first().should('have.attr', 'aria-disabled', 'false');
    }

    clickSort(label) {
        cy.get('div.w-full').contains('span[data-slot="label"]', label).click();
    }

    assertSortActive(label) {
        // У активного таба сортировки есть класс pointer-events-none (он же и делает
        // его некликабельным повторно) — по нему и отличаем активное состояние
        cy.get('div.w-full')
            .contains('span[data-slot="label"]', label)
            .closest('button,a')
            .should('have.class', 'pointer-events-none');
    }

    assertSortInactive(label) {
        cy.get('div.w-full')
            .contains('span[data-slot="label"]', label)
            .closest('button,a')
            .should('not.have.class', 'pointer-events-none');
    }

    clickShowMore() {
        cy.contains('button', 'Показать еще').click({ force: true });
    }

    assertShowMoreDisabled() {
        cy.contains('button', 'Показать еще').should('be.disabled');
    }

    clickPageNumber(number) {
        cy.contains('button', String(number)).click();
    }

    // Заголовок карточки акции — это <h3>, обёрнутый родительской ссылкой <a>
    get promoTitles() {
        return cy.get('h3');
    }

    clickPromoCardByTitle(title) {
        cy.contains('h3', title).click();
    }

    clickNthPromoCard(index) {
        cy.get('h3').eq(index).click();
    }
}

export default CatalogPage;
