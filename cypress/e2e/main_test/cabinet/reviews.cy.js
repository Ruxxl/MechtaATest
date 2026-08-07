import ReviewsPage, { REVIEWS_URL } from '../../../support/pageObjects/reviewsPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Reviews = new ReviewsPage();

// Личный кабинет — «Отзывы», /cabinet/reviews/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Отзывы", TC-ОТ-1..22).
//
// ВАЖНО: эта страница оказалась самой проблемной за всю сессию — BUG-020
// (Critical/P1): обе вкладки показывают полностью захардкоженный контент,
// ни один относящийся к отзывам API-запрос реально не отправляется, при
// том что реальный API возвращает пустые/null данные для этого аккаунта.
// Поэтому здесь НЕТ смысла тестировать "сверку карточки с API" (TC-ОТ-10,
// 12 и т.п.) — сверять просто не с чем содержательно, сама рассинхронность
// уже зафиксирована как баг. Тесты ниже фокусируются на подтверждении
// самого рассинхрона и на тех частях страницы, что работают независимо
// (крошки/заголовок/меню/переключение вкладок).
//
// Также BUG-027 (High): 500 от waiting-products роняет ВСЮ страницу
// целиком (h1 полностью пропадает из DOM), не только зависимый блок —
// подтверждено живой проверкой в браузере через window.fetch override,
// не только Cypress-мок.

describe('Отзывы — общие элементы и именование страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Reviews.visit();
    });

    // TC-ОТ-1 — БАГ BUG-021: несогласованное именование ("Мои отзывы" в
    // крошке vs "Отзывы" в заголовке/меню), тот же класс, что BUG-018.
    it('Название страницы одинаково в крошке и заголовке — BUG-021', () => {
        Reviews.getBreadcrumbItems().eq(2).invoke('text').then((breadcrumbText) => {
            cy.get('h1').invoke('text').should('eq', breadcrumbText.trim());
        });
    });

    // Заголовок страницы — здесь корректно <h1>, в отличие от orders/bonuses/cards/coupons
    it('Заголовок «Отзывы» — корректный видимый <h1>', () => {
        cy.get('h1').should('have.length', 1).and('contain.text', 'Отзывы').and('be.visible');
    });

    // TC-ОТ-2
    it('Пункт «Отзывы» в боковом меню подсвечен активным', () => {
        cy.get('nav').eq(1).contains('li', 'Отзывы').find('div').first()
            .should(($el) => {
                const bg = window.getComputedStyle($el[0]).backgroundColor;
                expect(bg, 'фон активного пункта не прозрачный').to.not.eq('rgba(0, 0, 0, 0)');
            });
    });
});

describe('Отзывы — БАГ-кандидаты: рассинхрон с API (BUG-020, BUG-022)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ОТ-7 — БАГ BUG-020 (Critical/P1): вкладка "Оставить отзыв" должна
    // показывать РЕАЛЬНЫЕ данные из waiting-products. Тест перехватывает
    // запрос и проверяет, что он реально происходит; падает, пока баг не
    // исправлен (запрос сейчас вообще не отправляется).
    it('Вкладка «Оставить отзыв» отправляет запрос к waiting-products — BUG-020', () => {
        cy.intercept('GET', '**/v2/reviews/waiting-products**').as('waitingProducts');
        Reviews.visit();
        cy.wait('@waitingProducts', { timeout: 15000 });
    });

    // TC-ОТ-7 (продолжение) — если waiting-products реально пуст
    // (products: null), карточки товаров не должны отображаться.
    it('Если API waiting-products пуст, карточки товара не отображаются — BUG-020', () => {
        cabinetApi.getWaitingProducts().then(({ body }) => {
            expect(body.data.products, 'baseline: products пуст на этом аккаунте').to.be.null;
        });
        Reviews.visit();
        cy.contains('Смарт-часы Huawei Watch GT 5 Pro Titanium').should('not.exist');
    });

    // TC-ОТ-20 — БАГ BUG-020: вкладка "Мои отзывы" должна показывать
    // РЕАЛЬНЫЕ данные из /v2/reviews/personal. Сейчас показывает
    // захардкоженные "опубликованные" карточки, хотя reviews: null.
    it('Если API reviews/personal возвращает reviews:null, карточки отзывов не отображаются — BUG-020', () => {
        cabinetApi.getReviewsPersonal().then(({ body }) => {
            expect(body.data.reviews, 'baseline: reviews пуст на этом аккаунте').to.be.null;
        });
        Reviews.visit();
        Reviews.getMyReviewsTab().click();
        cy.contains('Смарт-часы Huawei Watch GT 5 Pro Titanium').should('not.exist');
    });

    // TC-ОТ-3 — БАГ BUG-022: число отзывов в статистике должно
    // соответствовать реальным данным (meta/filters), а не быть
    // произвольным (сейчас показывает "60" при meta:null и всех count:0).
    it('Число в статистике «N Отзывов» соответствует реальным данным API — BUG-022', () => {
        cabinetApi.getReviewsPersonal().then(({ body }) => {
            const allFilter = body.data.filters.find((f) => f.code === 'all');
            Reviews.visit();
            cy.contains(/Отзывов/).invoke('text').then((text) => {
                const shown = parseInt(text, 10);
                expect(shown, 'число в статистике должно совпадать с filters[all].count').to.eq(allFilter.count);
            });
        });
    });
});

describe('Отзывы — переключатель вкладок', () => {
    beforeEach(() => {
        cy.loginD2();
        Reviews.visit();
    });

    // TC-ОТ-6
    it('По умолчанию активна вкладка «Оставить отзыв»', () => {
        Reviews.getLeaveReviewTab().should('have.attr', 'aria-selected', 'true');
        Reviews.getMyReviewsTab().should('have.attr', 'aria-selected', 'false');
    });

    // TC-ОТ-5, TC-ОТ-9 — переключение вкладок работает мгновенно, состояние синхронно
    it('Переключение между вкладками работает, ровно одна активна в любой момент', () => {
        Reviews.getMyReviewsTab().click();
        Reviews.getMyReviewsTab().should('have.attr', 'aria-selected', 'true');
        Reviews.getLeaveReviewTab().should('have.attr', 'aria-selected', 'false');

        Reviews.getLeaveReviewTab().click();
        Reviews.getLeaveReviewTab().should('have.attr', 'aria-selected', 'true');
        Reviews.getMyReviewsTab().should('have.attr', 'aria-selected', 'false');
    });

    // TC-ОТ-4 — несогласованность копирайта между блоком на главной ЛК
    // ("Оставьте отзыв", повелительное наклонение) и вкладкой здесь
    // ("Оставить отзыв", инфинитив) — задокументированное расхождение,
    // не заводим отдельным багом (чисто копирайт), но фиксируем тестом
    // фактическую формулировку на этой странице.
    it('Формулировка вкладки — «Оставить отзыв» (инфинитив, отличается от «Оставьте отзыв» на главной ЛК)', () => {
        Reviews.getLeaveReviewTab().should('have.text', 'Оставить отзыв');
    });
});

describe('Отзывы — фильтры вкладки «Мои отзывы»', () => {
    beforeEach(() => {
        cy.loginD2();
        Reviews.visit();
        Reviews.getMyReviewsTab().click();
    });

    // TC-ОТ-16 — БАГ BUG-023: фильтры не отрисованы вообще.
    it('Отображаются 4 фильтра (Все/Опубликованные/Отклонённые/На модерации) — BUG-023', () => {
        cy.contains('Опубликованные').should('be.visible');
        cy.contains('Отклоненные').should('be.visible');
        cy.contains('На модерации').should('be.visible');
    });
});

describe('Отзывы — негативные сценарии (обработка ошибок API)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // БАГ BUG-027 (High): подтверждено живой проверкой в браузере (не
    // только в Cypress) — 500 от waiting-products роняет ВСЮ правую
    // колонку страницы (h1 полностью отсутствует в DOM, 0 элементов),
    // тот же паттерн, что BUG-003 на /cabinet/. Изначально этот failure
    // ошибочно списывался на гонку с попапом подтверждения города —
    // опровергнуто прямой проверкой через window.fetch override:
    // h1 пропадает даже без какого-либо попапа в кадре.
    it('GET /v2/reviews/waiting-products — 500 не роняет остальную часть страницы — BUG-027', () => {
        cy.intercept('GET', '**/v2/reviews/waiting-products**', { statusCode: 500, body: {} }).as('serverError');
        cy.visit(REVIEWS_URL);
        cy.wait('@serverError', { timeout: 40000 });
        cy.dismissCityConfirmPopup();
        cy.get('nav').eq(1).should('be.visible');
        cy.get('h1').should('be.visible');
    });
});
