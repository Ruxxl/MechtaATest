// Личный кабинет — «Отзывы», /cabinet/reviews/, тестовый стенд d2.im.mdev.kz.
const REVIEWS_URL = 'http://d2.im.mdev.kz/cabinet/reviews/';

class ReviewsPage {
    visit() {
        cy.visit(REVIEWS_URL);
        // ВАЖНО: НЕ ждём intercept на waiting-products/reviews/personal
        // здесь намеренно — см. BUG-020, эти запросы часто вообще не
        // происходят на этой странице. Ждём простого рендера контента.
        cy.contains('Отзывы').should('be.visible');
    }

    getBreadcrumbItems() {
        return cy.get('nav[aria-label="breadcrumb"]').find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    // ВАЖНО: cy.contains(selector, text) возвращает только ПЕРВЫЙ найденный
    // элемент — при дублировании mobile/desktop DOM-узлов (подтверждено
    // разведкой 2026-08-07: по 2 копии каждой вкладки) это ненадёжно для
    // клика. Используем cy.get + filter(text) + filter(':visible')
    // (см. lesson в памяти проекта, найдено на cards.cy.js).
    getLeaveReviewTab() {
        return cy.get('button')
            .filter((_, el) => el.textContent.trim() === 'Оставить отзыв')
            .filter(':visible');
    }

    getMyReviewsTab() {
        return cy.get('button')
            .filter((_, el) => el.textContent.trim() === 'Мои отзывы')
            .filter(':visible');
    }
}

export default ReviewsPage;
export { REVIEWS_URL };
