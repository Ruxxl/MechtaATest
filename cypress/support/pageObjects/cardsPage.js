// Личный кабинет — «Мои карты», /cabinet/cards/, тестовый стенд d2.im.mdev.kz.
const CARDS_URL = 'http://d2.im.mdev.kz/cabinet/cards/';

class CardsPage {
    visit() {
        cy.intercept('GET', '**/v2/personal/card**').as('cardsLoad');
        cy.visit(CARDS_URL);
        // requestTimeout по умолчанию 5000ms (не переопределён в
        // cypress.config.js, в отличие от defaultCommandTimeout/
        // responseTimeout) — этого мало при случайных сетевых задержках
        // (уже наблюдались в этой сессии), поэтому увеличиваем явно.
        cy.wait('@cardsLoad', { timeout: 40000 });
    }

    getBreadcrumbItems() {
        return cy.get('nav[aria-label="breadcrumb"]').find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    // .parents('div').eq(1) — именно этот уровень оборачивает ОДНУ карту
    // целиком (border+rounded+padding — визуальная граница карточки, с
    // иконкой удаления внутри); eq(0)/first() слишком узкий, не включает
    // иконку удаления. Сверено разведкой 2026-08-07.
    getCardByMaskedPan(maskedPanWithSpaces) {
        return cy.contains(maskedPanWithSpaces).parents('div').eq(1);
    }

    // Иконка удаления — span.iconify.i-ph:trash-simple (сверено разведкой
    // 2026-08-07, тот же паттерн i-ph:*, что и в других местах проекта).
    // Принимает cy-чейнбл карточки (не jQuery-элемент) и просто дочерним
    // .find() ищет иконку внутри неё.
    getDeleteIcon(cardChainable) {
        return cardChainable.find('span[class*="i-ph:trash"]');
    }

    // Дублируется в DOM (мобильный/десктопный вариант через lg:hidden!) —
    // порядок между ними НЕ стабилен (различается между SSR-разметкой и
    // клиентской гидратацией, подтверждено разведкой 2026-08-07).
    // ВАЖНО: cy.contains(selector, text) возвращает только ОДИН (первый
    // попавшийся) элемент, а не коллекцию — .first()/.last()/.filter()
    // после него не помогают, если сам contains() уже выбрал скрытый.
    // Поэтому явно берём ВСЕ button через cy.get(), затем фильтруем по
    // тексту и видимости.
    getAddCardButton() {
        return cy.get('button')
            .filter((_, el) => el.textContent.trim() === 'Добавить карту')
            .filter(':visible');
    }
}

export default CardsPage;
export { CARDS_URL };
