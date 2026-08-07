// Личный кабинет — «Мои заказы», /cabinet/orders/, тестовый стенд d2.im.mdev.kz.
const ORDERS_URL = 'http://d2.im.mdev.kz/cabinet/orders/';

class OrdersPage {
    visit() {
        cy.visit(ORDERS_URL);
    }

    getBreadcrumbItems() {
        return cy.get('nav[aria-label="breadcrumb"]').find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    // Вкладки — <button role="tab"?> с текстом "Активные"/"Завершенные" (без "ё" —
    // сверено разведкой 2026-08-06), состояние — aria-selected
    getActiveTab() {
        return cy.contains('button', 'Активные');
    }

    getFinishedTab() {
        return cy.contains('button', 'Завершенные');
    }

    // Карточка заказа — <div class="bg-mi-brand-base-background..."> содержащая
    // "№ <id>"; кликабельная область — не <a>, навигация через JS (нет href)
    getOrderCardByNumber(orderId) {
        return cy.contains('p', `№ ${orderId}`).parents('div').eq(2);
    }

    getOrderCards() {
        // Каждая карточка — прямой контейнер с этим классом
        return cy.get('div[class*="bg-mi-brand-base-background"]');
    }

    getLoadMoreButton() {
        return cy.contains('button, div', 'Еще заказы');
    }
}

export default OrdersPage;
export { ORDERS_URL };
