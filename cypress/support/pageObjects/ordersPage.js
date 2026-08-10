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
    // "№ <id>"; кликабельная область — не <a>, навигация через JS (нет href).
    // ВАЖНО (2026-08-10, две находки при обходе реального списка из 900+ заказов):
    // 1) `cy.contains('p', text)` ищет ПОДСТРОКУ — регулярка с границей `(?!\d)`
    //    защищает от случая, когда искомый ID оказывается числовым префиксом
    //    другого ID на странице (напр. "№ 435" — подстрока "№ 4350").
    // 2) Фиксированный `.parents('div').eq(2)` НЕНАДЁЖЕН — глубина до настоящей
    //    границы карточки варьируется в зависимости от структуры заказа (напр.
    //    цифровые заказы без обычного фото товара имеют другую вложенность), из-за
    //    чего eq(2) может остановиться на общем контейнере СПИСКА, а не самой
    //    карточки. Поднимаемся динамически до реального класса-маркера карточки
    //    (тот же класс, что и в getOrderCards()) — так же, как это уже сделано в
    //    detailPage.js → _groupContainer для аналогичной проблемы.
    getOrderCardByNumber(orderId) {
        return cy.contains('p', new RegExp(`№\\s?${orderId}(?!\\d)`)).then(($p) => {
            let el = $p[0];
            while (el && el !== document.body && !(el.className && el.className.includes && el.className.includes('bg-mi-brand-base-background'))) {
                el = el.parentElement;
            }
            return cy.wrap(el);
        });
    }

    getOrderCards() {
        // Каждая карточка — прямой контейнер с этим классом
        return cy.get('div[class*="bg-mi-brand-base-background"]');
    }

    getLoadMoreButton() {
        return cy.contains('button, div', 'Еще заказы');
    }

    // Иконка копирования номера — <span class="iconify i-ph:copy ...">,
    // родной сосед <p>№ N</p> внутри общего div-контейнера с фоном-плашкой
    // (подтверждено разведкой 2026-08-10)
    getCopyIconByOrderNumber(orderId) {
        return cy.contains('p', `№ ${orderId}`).siblings('span[class*="i-ph:copy"]');
    }

    visitOrderDetail(orderId) {
        cy.visit(`http://d2.im.mdev.kz/cabinet/order/${orderId}/`);
    }

    // Кнопка "Отменить заказ" — только на детальной странице заказа
    getCancelButton() {
        return cy.contains('button', 'Отменить заказ');
    }
}

export default OrdersPage;
export { ORDERS_URL };
