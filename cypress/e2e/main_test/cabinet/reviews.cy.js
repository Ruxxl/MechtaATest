import ReviewsPage, { REVIEWS_URL } from '../../../support/pageObjects/reviewsPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Reviews = new ReviewsPage();

// Личный кабинет — «Отзывы», /cabinet/reviews/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Отзывы", TC-ОТ-1..22).
//
// ОБНОВЛЕНО 2026-08-10: раздел значительно переработан разработчиками.
// Изначально (2026-08-07) это была самая проблемная страница сессии —
// BUG-020 (Critical/P1, обе вкладки показывали захардкоженный контент, ни
// один реальный API-запрос не отправлялся) и BUG-022/BUG-027 — все ТРИ
// подтверждены исправленными живой проверкой и закрыты (Jira AS-4524/
// AS-4526/AS-4532 → «Готово», файлы удалены из BugReport). Раздел
// переехал с двух старых эндпоинтов (`GET /v2/reviews/waiting-products` +
// `GET /v2/reviews/personal`) на ОДИН новый `GET /v3/personal/reviews`
// (`{reviews, meta, summary}`, без `result/errors/data` обёртки и без
// `filters[]` — см. cabinetApi.getPersonalReviewsV3). Тесты ниже
// переписаны под новый контракт.
//
// Ещё открыт: BUG-021 (несогласованное именование крошки).
// BUG-023 (фильтры «Опубликованные»/«Отклонённые»/«На модерации» на
// вкладке «Мои отзывы» не отрисованы) закрыт как не баг 2026-08-10: по
// дизайну (макеты «5. Отзывы» / «7. Отзывы») на вкладке предусмотрены
// только «Оставить отзыв»/«Мои отзывы», без под-фильтров по статусу —
// они никогда не будут реализованы. Jira AS-4527 → «Не актуален»,
// BugReport-файл удалён, тест на 4 фильтра убран.

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

describe('Отзывы — данные соответствуют реальному API (/v3/personal/reviews)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ОТ-7 — BUG-020 ИСПРАВЛЕН: вкладка «Оставить отзыв» теперь реально
    // дожидается ответа нового эндпоинта (раньше — ни одного релевантного
    // запроса вообще не отправлялось).
    it('Вкладка «Оставить отзыв» отправляет запрос к /v3/personal/reviews', () => {
        cy.intercept('GET', '**/v3/personal/reviews**').as('reviewsV3');
        Reviews.visit();
        cy.wait('@reviewsV3', { timeout: 15000 });
    });

    // BUG-020 ИСПРАВЛЕН: старый захардкоженный демо-товар («Смарт-часы
    // Huawei Watch GT 5 Pro Titanium») полностью исчез — подтверждено
    // 2026-08-10, вкладка теперь показывает реальные товары из истории
    // покупок (напр. «Обогреватель BALLU BOH/EX-11» — сверено побайтово
    // совпадает с товаром из bonuses-history этого же аккаунта).
    it('Старый захардкоженный товар «Смарт-часы Huawei Watch» больше не показывается', () => {
        Reviews.visit();
        cy.contains('Смарт-часы Huawei Watch GT 5 Pro Titanium').should('not.exist');
    });

    // TC-ОТ-20 — BUG-020 ИСПРАВЛЕН: при реально пустом reviews:[] вкладка
    // «Мои отзывы» теперь показывает настоящий empty state («Закажите и
    // оставьте отзыв!»), а не 3 захардкоженные карточки «опубликованного»
    // отзыва, как было раньше.
    it('При reviews:[] вкладка «Мои отзывы» показывает настоящий empty state', () => {
        cabinetApi.getPersonalReviewsV3().then(({ body }) => {
            expect(body.reviews, 'baseline: у аккаунта пока нет реальных отзывов').to.have.length(0);
        });
        Reviews.visit();
        Reviews.getMyReviewsTab().click();
        cy.contains('Закажите и оставьте отзыв').should('be.visible');
        cy.contains('Смарт-часы Huawei Watch GT 5 Pro Titanium').should('not.exist');
    });

    // TC-ОТ-3 — BUG-022 ИСПРАВЛЕН: число в статистике теперь берётся из
    // реального summary.publishedCount/likesCount (раньше показывало
    // произвольное «60» при meta:null и всех filters[].count: 0 в старом
    // контракте — теперь такого поля вовсе нет, сверяем с новым).
    it('Числа в статистике соответствуют summary.publishedCount/likesCount', () => {
        // ВАЖНО: число и подпись — СОСЕДНИЕ div, а не один текстовый узел
        // (напр. <div>0</div><div>отзывов</div>) — сверено разведкой
        // 2026-08-10. Плюс дублируется в dual mobile/desktop DOM (см. общий
        // паттерн проекта) — climb до родителя и фильтруем :visible.
        function statValue(label) {
            return cy.get('main div')
                .filter((_, el) => el.children.length === 0 && el.textContent.trim() === label)
                .filter(':visible')
                .then(($label) => {
                    const parentText = $label[0].parentElement.textContent.trim();
                    return parseInt(parentText, 10);
                });
        }
        cy.intercept('GET', '**/v3/personal/reviews**').as('reviewsV3');
        Reviews.visit();
        cy.wait('@reviewsV3', { timeout: 15000 }).then(({ response }) => {
            const { publishedCount, likesCount } = response.body.summary;
            statValue('отзывов').should('eq', publishedCount);
            statValue('лайков').should('eq', likesCount);
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

describe('Отзывы — негативные сценарии (обработка ошибок API)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // BUG-027 ИСПРАВЛЕН (High): раньше 500 от waiting-products ронял ВСЮ
    // правую колонку страницы (h1 полностью отсутствовал в DOM), тот же
    // паттерн, что BUG-003 на /cabinet/ (тоже исправлен). Подтверждено
    // 2026-08-10: с мокнутой 500 на новом эндпоинте (сменившем старый
    // waiting-products) страница продолжает рендериться нормально.
    it('GET /v3/personal/reviews — 500 не роняет остальную часть страницы', () => {
        cy.intercept('GET', '**/v3/personal/reviews**', { statusCode: 500, body: {} }).as('serverError');
        cy.visit(REVIEWS_URL);
        cy.wait('@serverError', { timeout: 40000 });
        cy.get('nav').eq(1).should('be.visible');
        cy.get('h1').should('be.visible');
    });
});
