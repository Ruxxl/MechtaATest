// Личный кабинет — «Отзывы», /cabinet/reviews/, тестовый стенд d2.im.mdev.kz.
const REVIEWS_URL = 'http://d2.im.mdev.kz/cabinet/reviews/';

class ReviewsPage {
    visit() {
        cy.visit(REVIEWS_URL);
        // ВАЖНО (обновлено 2026-08-10): раздел переехал на единственный
        // эндпоинт GET /v3/personal/reviews (см. cabinetApi.getPersonalReviewsV3) —
        // он реально вызывается при заходе. Не ждём его тут через intercept
        // намеренно, чтобы не плодить гонку алиасов с тестами, которые сами
        // ставят свой intercept ДО visit(); ждём простого рендера контента.
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
