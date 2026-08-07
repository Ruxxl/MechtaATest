// Личный кабинет — «Бонусы и фишки», /cabinet/bonuses/, тестовый стенд d2.im.mdev.kz.
const BONUSES_URL = 'http://d2.im.mdev.kz/cabinet/bonuses/';

class BonusesPage {
    // Дожидаемся ответа bonuses-history перед тем, как отдать управление
    // тесту — без этого первые проверки после cy.visit() иногда стартуют
    // раньше, чем список успевает отрисоваться (skeleton ещё на экране),
    // и cy.contains() не находит текст карточки в течение таймаута.
    visit() {
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('bonusesHistoryLoad');
        cy.visit(BONUSES_URL);
        // requestTimeout по умолчанию 5000ms — недостаточно при случайных
        // сетевых задержках, увеличиваем явно (см. cardsPage.js)
        cy.wait('@bonusesHistoryLoad', { timeout: 40000 });
    }

    getBreadcrumbItems() {
        return cy.get('nav[aria-label="breadcrumb"]').find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    // Карточка операции: заголовок дублируется в DOM (мобильный вариант
    // "Заказ №X • 6 августа" caption-стилем + десктопный "Заказ №X" отдельным
    // крупным текстом, оба — обычные <p>, не heading-теги — сверено разведкой
    // 2026-08-07, тот же dual mobile/desktop паттерн, что и в других местах
    // проекта). Берём именно точное совпадение "Заказ №X" (десктопный вариант).
    // .parents('div').eq(5) — именно этот уровень оборачивает ВСЮ карточку
    // целиком (заголовок + плашки бонусов/фишек + "Показать детали" +
    // разворачиваемый список товаров) как единый rounded-mi-l блок; уровни
    // 0-4 — только внутренние обёртки заголовка, не включают плашки.
    getOperationCardByOrderId(orderId) {
        return cy.contains('p', new RegExp(`^Заказ №${orderId}$`)).parents('div').eq(5);
    }

    // Внутри карточки: "Показать детали"/"Скрыть детали" переключает раскрытие
    toggleDetails($card) {
        cy.wrap($card).contains(/Показать детали|Скрыть детали/).click();
    }

    getLoadMoreButton() {
        return cy.contains('button, div', 'Показать ещё');
    }
}

export default BonusesPage;
export { BONUSES_URL };
