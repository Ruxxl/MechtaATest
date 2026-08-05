// TC-REV-01..08 из Mechta_ProductPage_TestCases.xlsx: рейтинг и отзывы (блок 3).
// Разведка 2026-08-05:
// - Сортировка (TC-REV-01/02/03): вкладки "Все"/"Полезные"/"С высокими оценками"/
//   "С низкими оценками" — id вкладки "reka-tabs-v-0-0-1-0-trigger-{code}", где code
//   совпадает с sorts[].code из ответа /reviews (all/helpful/high/low). Клик шлёт
//   РЕАЛЬНЫЙ запрос GET /reviews?sort={code}&page=0 (не клиентская пересортировка).
//   Для содержательной проверки нужен товар со СМЕШАННЫМИ оценками — на fixtures.
//   withReviews (AirPods) все 7 отзывов 5★, там "высокие/низкие" ничего не меняют
//   по сути; используется fixtures.withMixedReviews (5×5★+1×4★).
// - TC-REV-04 ("Показать все отзывы") — этой функциональности НЕТ на сайте, см.
//   BugReport/Товар/README.md. Товар с totalPages=2 (AirPods, 7 отзывов, perPage=6)
//   показывает только первые 6, без единого способа увидеть 7-й — ни кнопки, ни
//   пагинации. Не баг, а отсутствующая фича — тест не пишется.
// - Лайк/дизлайк (TC-REV-05..08): устойчивые id "#product-review-like-{index}" /
//   "#product-review-dislike-{index}". POST /api/v3/reviews/vote ПЕРЕКЛЮЧАЕТ голос
//   туда-обратно (тело содержит cancel:true/false) — повторный клик СНИМАЕТ голос,
//   а не превращает like в dislike. Активный голос — класс иконки
//   "i-ph:thumbs-up-fill"/"i-ph:thumbs-down-fill", неактивный — без "-fill".
// - НАЙДЕН БАГ (см. BUG-005, TC-REV-07): анонимный клик лайка/дизлайка получает
//   реальный 401 от API, но фронтенд НИКАК не реагирует — ни модалки логина (как
//   везде в проекте для похожих действий), ни сообщения, ни отката состояния.
// - TC-REV-08 (ошибка API у авторизованного): подтверждено — при 500 иконка/счётчик
//   просто не меняются вообще (нет ложного "оптимистичного" обновления, которое
//   нужно было бы откатывать) — итоговое состояние корректно, тест проходит.
// - Фото в отзывах (нестандартная проверка, явного TC в Excel нет — оформлено в
//   рамках блока TC-REV): отзывы приходят с бэка с полем photos[] (large/thumb/
//   original/small URL). На странице отрисовываются миниатюры (img src содержит
//   apltcdn/media_files) СТРОГО внутри <li> того же отзыва — closest('li') от
//   #product-review-like-{index} надёжно скоупит именно эту карточку (проверено
//   разведкой: отзыв с 1 фото → 1 img в li, с 3 фото → 3 img в li). Клик открывает
//   [role="dialog"] с полноразмерным фото, счётчиком "N из M", стрелками навигации
//   и ПОЛНЫМ контекстом отзыва (автор, звёзды рейтинга, лайки/дизлайки, текст) —
//   это тоже должно совпадать с данными ИМЕННО открытого отзыва. У закрывающей
//   CSS-анимации диалога заметная длительность — до ~1.5с, иначе проверка "закрылось"
//   даёт ложный "ещё открыто".
import { assertLoginModalShown } from '../../../support/helpers/authModal';
import productPage from '../../../support/pageObjects/product_page';

const ProductPage = new productPage();

describe('Страница товара: рейтинг и отзывы (TC-REV-01..08)', () => {

    describe('Сортировка отзывов', () => {

        let productUrl;
        before(() => {
            cy.fixture('products').then((p) => { productUrl = p.withMixedReviews.url; });
        });

        const cases = [
            { tc: 'TC-REV-01', label: 'С высокими оценками', code: 'high' },
            { tc: 'TC-REV-02', label: 'С низкими оценками', code: 'low' },
            { tc: 'TC-REV-03', label: 'Полезные', code: 'helpful' },
        ];

        cases.forEach(({ tc, label, code }) => {
            it(`${tc}: фильтр "${label}" шлёт запрос с sort=${code} и меняет порядок отзывов`, () => {
                cy.intercept('GET', '**/api/v3/product/*/reviews*').as('reviews');
                cy.visit(productUrl);
                cy.wait('@reviews', { timeout: 20000 }).then((initial) => {
                    const initialIds = initial.response.body.reviews.map((r) => r.id);

                    cy.intercept('GET', `**/api/v3/product/*/reviews?sort=${code}*`).as('sortedReviews');
                    ProductPage.clickReviewSort(code);
                    cy.wait('@sortedReviews', { timeout: 20000 }).then((sorted) => {
                        expect(sorted.request.url, 'запрос должен содержать правильный sort').to.include(`sort=${code}`);
                        const sortedReviews = sorted.response.body.reviews;
                        expect(sortedReviews.map((r) => r.id).sort(), 'должен быть тот же набор отзывов, просто в другом порядке')
                            .to.deep.equal([...initialIds].sort());

                        if (code === 'high' || code === 'low') {
                            const ratings = sortedReviews.map((r) => r.rating);
                            const expectedOrder = code === 'high' ? [...ratings].sort((a, b) => b - a) : [...ratings].sort((a, b) => a - b);
                            expect(ratings, `для sort=${code} отзывы должны быть отсортированы по рейтингу`).to.deep.equal(expectedOrder);
                        }
                    });
                });
            });
        });
    });

    describe('Лайк/дизлайк отзыва', () => {

        let productUrl;
        before(() => {
            cy.fixture('products').then((p) => { productUrl = p.withReviews.url; });
        });

        it('TC-REV-05/06: авторизованный пользователь переключает лайк и дизлайк, подтверждено API', () => {
            cy.login();
            cy.intercept('GET', '**/api/v3/product/*/reviews*').as('reviews');
            cy.intercept('POST', '**/api/v3/reviews/vote').as('vote');
            cy.visit(productUrl);
            cy.wait('@reviews', { timeout: 20000 }).then((interception) => {
                const review = interception.response.body.reviews[1];
                const wasLiked = review.userVote === 'like';

                // Лайк переключается в противоположное состояние
                ProductPage.reviewLikeButton(1).click();
                cy.wait('@vote', { timeout: 10000 }).then(({ request, response }) => {
                    expect(response.statusCode).to.eq(204);
                    expect(request.body).to.deep.include({ reviewId: review.id, opinion: 'like', cancel: wasLiked });
                });
                ProductPage.assertReviewVoteActive(1, 'like', !wasLiked);

                // Лайк/дизлайк — ВЗАИМОИСКЛЮЧАЮЩИЕ (единое поле userVote, не два
                // независимых). После клика по лайку текущий голос — 'like' или null,
                // НИКОГДА не 'dislike' — поэтому клик по дизлайку здесь всегда СВЕЖИЙ
                // голос (cancel:false), а не переключение старого состояния, и он
                // должен снять лайк, выставленный шагом выше (разведкой подтверждено:
                // первая попытка теста ошибочно считала дизлайк независимым от лайка
                // и падала на cancel)
                ProductPage.reviewDislikeButton(1).click();
                cy.wait('@vote', { timeout: 10000 }).then(({ request, response }) => {
                    expect(response.statusCode).to.eq(204);
                    expect(request.body).to.deep.include({ reviewId: review.id, opinion: 'dislike', cancel: false });
                });
                ProductPage.assertReviewVoteActive(1, 'dislike', true);
                ProductPage.assertReviewVoteActive(1, 'like', false);
            });
        });

        // BugReport/Товар/BUG-005: анонимный клик получает реальный 401 от API, но
        // фронтенд никак не реагирует. Тест целенаправленно проверяет ОЖИДАЕМОЕ
        // поведение (модалка логина, как везде в проекте) и падает, документируя баг.
        it('TC-REV-07 / БАГ: лайк неавторизованным пользователем должен показать модалку логина — см. BUG-005', () => {
            cy.visit(productUrl);
            ProductPage.reviewLikeButton(0).click();
            assertLoginModalShown();
        });

        it('TC-REV-08: ошибка API при голосовании — состояние иконки не меняется (нет ложного успеха)', () => {
            cy.login();
            cy.intercept('POST', '**/api/v3/reviews/vote', { statusCode: 500, body: { error: 'internal' } }).as('voteError');
            cy.visit(productUrl);
            ProductPage.reviewLikeButton(0).find('[class*="iconify"]').invoke('attr', 'class').then((before) => {
                ProductPage.reviewLikeButton(0).click();
                cy.wait('@voteError', { timeout: 10000 });
                cy.wait(1000);
                ProductPage.reviewLikeButton(0).find('[class*="iconify"]').should('have.attr', 'class', before);
            });
        });
    });

    describe('Фото в отзывах (нестандартная проверка в рамках TC-REV)', () => {

        let productUrl;
        before(() => {
            cy.fixture('products').then((p) => { productUrl = p.withReviews.url; });
        });

        it('фото из API (photos[]) отображаются на странице у своего отзыва, галерея показывает контекст ИМЕННО этого отзыва', () => {
            cy.intercept('GET', '**/api/v3/product/*/reviews*').as('reviews');
            cy.visit(productUrl);
            cy.wait('@reviews', { timeout: 20000 }).then((interception) => {
                const reviews = interception.response.body.reviews;
                const index = reviews.findIndex((r) => (r.photos || []).length > 1);
                expect(index, 'на странице должен быть хотя бы один отзыв с несколькими фото').to.be.at.least(0);
                const review = reviews[index];

                // Фото пришли с бэка и отрисованы — ровно столько миниатюр, сколько photos[]
                ProductPage.reviewPhotoThumbnails(index).should('have.length', review.photos.length);

                ProductPage.clickReviewPhotoThumbnail(index, 0);
                ProductPage.photoGalleryDialog.should('be.visible');
                ProductPage.photoGalleryCounter.should('contain.text', `1 из ${review.photos.length}`);
                ProductPage.assertPhotoGalleryMatchesReview(review);

                // Стрелка "вперёд" листает ИМЕННО фото этого отзыва, а не какого-то другого
                ProductPage.clickPhotoGalleryNext();
                ProductPage.photoGalleryCounter.should('contain.text', `2 из ${review.photos.length}`);
                ProductPage.assertPhotoGalleryMatchesReview(review);

                ProductPage.closePhotoGalleryByEsc();
                cy.get('[role="dialog"]').should('not.exist');
            });
        });

        it('фото отзыва закрывается по клику на крестик', () => {
            cy.intercept('GET', '**/api/v3/product/*/reviews*').as('reviews');
            cy.visit(productUrl);
            cy.wait('@reviews', { timeout: 20000 }).then((interception) => {
                const reviews = interception.response.body.reviews;
                const index = reviews.findIndex((r) => (r.photos || []).length > 0);
                expect(index, 'на странице должен быть хотя бы один отзыв с фото').to.be.at.least(0);

                ProductPage.clickReviewPhotoThumbnail(index, 0);
                ProductPage.photoGalleryDialog.should('be.visible');

                ProductPage.photoGalleryDialog.find('span[class*="i-ph:x "]').closest('button').click();
                cy.wait(1500);
                cy.get('[role="dialog"]').should('not.exist');
            });
        });
    });
});
