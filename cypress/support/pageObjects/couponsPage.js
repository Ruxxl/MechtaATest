// Личный кабинет — «Купоны», /cabinet/coupons/, тестовый стенд d2.im.mdev.kz.
// ВАЖНО: страница называется по-разному в разных местах — крошка/вкладка
// браузера "Мои купоны", заголовок/меню "Купоны" (см. BUG-018).
const COUPONS_URL = 'http://d2.im.mdev.kz/cabinet/coupons/';

class CouponsPage {
    visit() {
        cy.intercept('GET', '**/v3/personal/promo-codes**').as('couponsLoad');
        cy.visit(COUPONS_URL);
        cy.wait('@couponsLoad', { timeout: 40000 });
    }

    getBreadcrumbItems() {
        return cy.get('nav[aria-label="breadcrumb"]').find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    getActiveTab() {
        return cy.contains('button', 'Активные');
    }

    getUsedTab() {
        return cy.contains('button', 'Завершенные');
    }
}

export default CouponsPage;
export { COUPONS_URL };
