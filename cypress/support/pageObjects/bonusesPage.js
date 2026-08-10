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
    // ВАЖНО (2026-08-10): фиксированный `.parents('div').eq(5)` НЕНАДЁЖЕН —
    // по той же причине, что уже была найдена и исправлена в ordersPage.js
    // → getOrderCardByNumber (глубина до границы карточки плавает в
    // зависимости от структуры заказа — напр. количество товаров/наличие
    // плашек). Живой разведкой 2026-08-10 подтверждено, что реальная граница
    // карточки — не фиксированный уровень, а div с классом-маркером
    // "bg-mi-brand-base-background" (тот же маркер, что и в ordersPage.js).
    // Поднимаемся динамически до него, а не считаем уровни.
    // "Оффлайн заказ" — псевдо-ID офлайн/системных операций (order_id
    // буквально равен этой строке), заголовок на карточке рендерится БЕЗ
    // префикса "Заказ №" (сверено разведкой 2026-08-10) — единственный
    // случай, когда префикс не добавляется. ВНИМАНИЕ: этот заголовок может
    // повторяться на НЕСКОЛЬКИХ карточках одновременно (несколько офлайн-
    // /системных операций) — cy.contains() отдаёт только ПЕРВУЮ совпавшую,
    // так что для этого orderId метод не различает конкретную операцию
    // (см. вызывающий код — TC-БО-21 намеренно пропускает такие записи).
    getOperationCardByOrderId(orderId) {
        const pattern = orderId === 'Оффлайн заказ' ? new RegExp(`^${orderId}$`) : new RegExp(`^Заказ №${orderId}$`);
        return cy.contains('p', pattern).then(($p) => {
            let el = $p[0];
            while (el && el !== document.body && !(el.className && el.className.includes && el.className.includes('bg-mi-brand-base-background'))) {
                el = el.parentElement;
            }
            return cy.wrap(el);
        });
    }

    // Внутри карточки: "Показать детали"/"Скрыть детали" переключает раскрытие
    toggleDetails($card) {
        cy.wrap($card).contains(/Показать детали|Скрыть детали/).click();
    }

    // BUG-014 (Jira AS-4516) ИСПРАВЛЕН 2026-08-10: реализована не кнопка
    // «Показать ещё» (как ожидал изначальный баг-репорт), а полноценная
    // нумерованная пагинация — ссылки <a href="?page=N">, доступное имя
    // задаётся через aria-label ("Page N"/"Next Page"/"Previous Page"/
    // "First Page"/"Last Page"), а НЕ через видимый текстовый контент (у
    // стрелочных ссылок textContent вообще пустой — сверено разведкой
    // 2026-08-10). Обход API по всем страницам даёт ровно all_items_count
    // элементов без дублей/пропусков, последняя страница отдаёт корректный
    // остаток.
    getPageLink(page) {
        return cy.get(`a[aria-label="Page ${page}"]`);
    }

    getNextPageLink() {
        return cy.get('a[aria-label="Next Page"]');
    }

    getPreviousPageLink() {
        return cy.get('a[aria-label="Previous Page"]');
    }

    getFirstPageLink() {
        return cy.get('a[aria-label="First Page"]');
    }

    // На последней странице "Next Page" перестаёт быть ссылкой (рендерится
    // как <button>, без href), а "Last Page" остаётся тегом <a>, но без
    // href и с атрибутом disabled="true" — сверено разведкой 2026-08-10.
    getLastPageLink() {
        return cy.get('[aria-label="Last Page"]');
    }
}

export default BonusesPage;
export { BONUSES_URL };
