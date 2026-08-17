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
// BUG-021 (несогласованное именование: крошка «Мои отзывы» vs заголовок/
// меню «Отзывы») закрыт как не баг 2026-08-11: подтверждено пользователем,
// что это намеренное решение (притяжательная форма в крошке, нейтральная
// в заголовке/меню), а не рассинхронизация источников текста, как было в
// BUG-018 на «Купонах». Jira AS-4525 → «Готово» (по решению владельца
// проекта статус в Jira для закрытых багов всегда «Готово» независимо от
// причины закрытия — содержательная причина здесь: не баг), BugReport-файл
// удалён, тест TC-ОТ-1 убран.
// BUG-023 (фильтры «Опубликованные»/«Отклонённые»/«На модерации» на
// вкладке «Мои отзывы» не отрисованы) закрыт как не баг 2026-08-10: по
// дизайну (макеты «5. Отзывы» / «7. Отзывы») на вкладке предусмотрены
// только «Оставить отзыв»/«Мои отзывы», без под-фильтров по статусу —
// они никогда не будут реализованы. Jira AS-4527 → «Готово» (та же причина
// — статус в Jira всегда «Готово»), BugReport-файл удалён, тест на 4
// фильтра убран.
//
// ОБНОВЛЕНО 2026-08-11: у тестового аккаунта на стенде появились 2 РЕАЛЬНЫХ
// отзыва (набрались в ходе прошлых сессий тестирования) — старый baseline
// «у аккаунта всегда 0 отзывов» протух, тест на empty state переписан на
// мок вместо зависимости от live-состояния аккаунта (см. ниже). Заодно
// проведён полный полевой аудит обеих вкладок (сверка каждого поля с
// API) — вкладка «Оставить отзыв» полностью корректна (название, превью,
// бонус-бейдж совпадают с /v3/personal/products-for-reviews; все 4 товара
// подтверждены как реальные завершённые покупки по numericId). На вкладке
// «Мои отзывы» изначально был заведён BUG-035 (Jira AS-4561): карточка
// отзыва не показывает текст отзыва, теги и собственные фото на десктопном
// viewport. Отклонён как не баг 2026-08-17 (подтверждено пользователем —
// намеренное поведение), файл удалён, см. историю в README.md этой папки.

describe('Отзывы — общие элементы и именование страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Reviews.visit();
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
    //
    // ПЕРЕПИСАНО 2026-08-11: у аккаунта на стенде теперь реально есть 2
    // отзыва (не 0), поэтому baseline-проверка "у аккаунта 0 отзывов" стала
    // false-negative — сама вкладка при этом продолжает работать корректно.
    // Мокаем reviews:[] напрямую (см. секцию 5.5 skill'а — предпочитать стаб
    // реальному состоянию аккаунта, которое может измениться), чтобы тест не
    // зависел от live-данных.
    it('При reviews:[] вкладка «Мои отзывы» показывает настоящий empty state (замокано)', () => {
        cy.intercept('GET', '**/v3/personal/reviews**', {
            statusCode: 200,
            body: {
                reviews: [],
                meta: { currentPage: 1, totalPages: 1, perPage: 10, totalCount: 0 },
                summary: { publishedCount: 0, likesCount: 0, accruedBonusAmount: 0 },
            },
        }).as('emptyReviews');
        Reviews.visit();
        Reviews.getMyReviewsTab().click();
        cy.wait('@emptyReviews');
        cy.contains('Закажите и оставьте отзыв').should('be.visible');
        cy.contains('Смарт-часы Huawei Watch GT 5 Pro Titanium').should('not.exist');
    });

    // Мок-матрица likes/dislikes (по просьбе пользователя, 2026-08-11): фронт
    // должен корректно отрисовывать ЛЮБОЕ значение поля, а не только то, что
    // сейчас реально стоит на аккаунте (0/0) — см. секцию 5.5 skill'а. Живой
    // разведкой подтверждено: значения рендерятся как есть, без валидации —
    // 0, обычное число, огромное число и даже отрицательное — без NaN и без
    // падений (отрицательное значение — гипотетический malformed-инпут,
    // реальный бэк такого не пришлёт, но фронт и на него не падает).
    [
        { likes: 0, dislikes: 0, label: 'нули' },
        { likes: 5, dislikes: 3, label: 'обычные числа' },
        { likes: 9999, dislikes: 12345, label: 'огромные числа' },
        { likes: -1, dislikes: -1, label: 'отрицательные (malformed)' },
    ].forEach(({ likes, dislikes, label }) => {
        it(`Лайки/дизлайки отзыва рендерятся как есть: ${label} (likes=${likes}, dislikes=${dislikes})`, () => {
            cy.intercept('GET', '**/v3/personal/reviews**', {
                statusCode: 200,
                body: {
                    reviews: [{
                        id: 'mock1',
                        product: {
                            id: 'mock-uuid', name: 'Тестовый товар для мока', slug: 'test', code: '1', numericId: 1,
                            images: [], preview: 'https://pi.mdev.kz/8cee685b-3546-4df5-9d74-cf68fb297dbb',
                            availability: 'notAvailable', preorder: null, prices: null, discount: null, credit: null,
                            stickers: null, mainProperties: null, categories: [], rating: null, userFlags: null,
                            shipment: null, propertyGroups: null, metrics: null, onlyShopwindow: false,
                            tradeInAvailable: false, chipsPromotion: null, productType: 'DefaultProductType',
                        },
                        createdAt: '2026-08-11T11:40:25Z', status: 'published', rating: 5,
                        body: 'Тестовый текст отзыва', accruedBonusAmount: null, likes, dislikes, photos: [], tags: null,
                    }],
                    meta: { currentPage: 1, totalPages: 1, perPage: 10, totalCount: 1 },
                    summary: { publishedCount: 1, likesCount: likes, accruedBonusAmount: 0 },
                },
            }).as('mockReviews');
            Reviews.visit();
            Reviews.getMyReviewsTab().click();
            cy.wait('@mockReviews');
            cy.contains('Опубликован', { timeout: 10000 }).should('be.visible');
            cy.get('main .iconify.i-ph\\:thumbs-up-fill').filter(':visible')
                .then(($el) => $el[0].parentElement.textContent.trim())
                .should('eq', String(likes));
            cy.get('main .iconify.i-ph\\:thumbs-down-fill').filter(':visible')
                .then(($el) => $el[0].parentElement.textContent.trim())
                .should('eq', String(dislikes));
        });
    });

    // TC-ОТ-3 — BUG-022 ИСПРАВЛЕН: число в статистике теперь берётся из
    // реального summary.publishedCount/likesCount (раньше показывало
    // произвольное «60» при meta:null и всех filters[].count: 0 в старом
    // контракте — теперь такого поля вовсе нет, сверяем с новым).
    //
    // ПЕРЕПИСАНО 2026-08-11: раньше подпись искалась по точной строке
    // 'отзывов'/'лайков' — сломалось, когда живой publishedCount стал 2
    // (правильная русская форма — «2 отзыва», а не «отзывов»). Подпись
    // теперь ищем по regex-подстроке (корень слова), независимо от формы
    // множественного числа.
    it('Числа в статистике соответствуют summary.publishedCount/likesCount', () => {
        // ВАЖНО: число и подпись — СОСЕДНИЕ div, а не один текстовый узел
        // (напр. <div>2</div><div>отзыва</div>) — сверено разведкой
        // 2026-08-10. Плюс дублируется в dual mobile/desktop DOM (см. общий
        // паттерн проекта) — climb до родителя и фильтруем :visible.
        //
        // ВАЖНО (2026-08-11): вся логика поиска+сравнения — ВНУТРИ ОДНОГО
        // cy.should(callback), а не в промежуточном .then(). Числа
        // подгружаются асинхронно (см. аналогичную задержку у названия
        // товара на «Мои отзывы»), и .then() выполняется один раз без
        // повторных попыток — из-за этого тест иногда ловил ПРОМЕЖУТОЧНОЕ
        // состояние DOM (плейсхолдер «0» до обновления) и падал с «expected
        // 0 to equal 2». cy.should(callback) переисполняет весь колбэк при
        // каждом ретрае, пока DOM не устаканится или не истечёт таймаут.
        function assertStatValue(labelSubstring, expected) {
            cy.get('main div', { timeout: 20000 })
                .should(($divs) => {
                    const numDivs = $divs.toArray().filter(
                        (el) => el.offsetParent !== null && el.children.length === 0 && /^\d+$/.test(el.textContent.trim()),
                    );
                    const match = numDivs.find((numEl) => {
                        const labelEl = Array.from(numEl.parentElement.children).find((c) => c !== numEl);
                        return labelEl && labelEl.textContent.trim().toLowerCase().includes(labelSubstring);
                    });
                    expect(match, `не нашли div с числом рядом с подписью, содержащей «${labelSubstring}»`).to.exist;
                    expect(parseInt(match.textContent.trim(), 10), `значение подписи «${labelSubstring}»`).to.eq(expected);
                });
        }
        cy.intercept('GET', '**/v3/personal/reviews**').as('reviewsV3');
        Reviews.visit();
        cy.wait('@reviewsV3', { timeout: 15000 }).then(({ response }) => {
            const { publishedCount, likesCount } = response.body.summary;
            assertStatValue('отзыв', publishedCount);
            assertStatValue('лайк', likesCount);
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

// Аудит 2026-08-11: сверка вкладки «Оставить отзыв» с реальным ответом
// GET /v3/personal/products-for-reviews по каждому полю (название, превью,
// бонус-бейдж), плюс проверка, что каждый показанный товар — реальная
// завершённая покупка (не хардкод).
describe('Отзывы — вкладка «Оставить отзыв»: карточка товара соответствует API', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    it('Название и превью каждого товара совпадают с /v3/personal/products-for-reviews', () => {
        cabinetApi.getProductsForReviews().then(({ body }) => {
            expect(body.products, 'на аккаунте есть хотя бы 1 товар, ожидающий отзыва').to.have.length.greaterThan(0);
            Reviews.visit();

            body.products.forEach(({ product }) => {
                cy.contains(product.name).should('be.visible');
                // Превью реально грузится (а не просто присутствует src) —
                // naturalWidth > 0 только у реально загруженной картинки.
                cy.get(`img[src="${product.preview}"]`).should('be.visible')
                    .and(($img) => {
                        expect($img[0].naturalWidth, `превью «${product.name}» реально загрузилось, не битое`).to.be.greaterThan(0);
                    });
            });
        });
    });

    // Бонус-бейдж «+ N Б» (класс p.text-mi-brand-text-brand — сверено
    // разведкой 2026-08-11) должен показываться СТРОГО у товаров с
    // canGetBonuses:true и ни у каких других.
    it('Бонус-бейдж показывается ровно у товаров с canGetBonuses:true', () => {
        cabinetApi.getProductsForReviews().then(({ body }) => {
            const eligibleCount = body.products.filter((p) => p.canGetBonuses).length;
            Reviews.visit();
            // Ждём, пока хотя бы первая карточка товара реально отрисуется
            // (название подгружается асинхронно, см. аналогичную задержку
            // на «Мои отзывы») — иначе бейджи бонусов ещё не успевают
            // появиться и cy.get ниже ловит промежуточное пустое состояние.
            cy.contains(body.products[0].product.name, { timeout: 20000 }).should('be.visible');
            cy.get('main p.text-mi-brand-text-brand', { timeout: 20000 }).filter(':visible')
                .should('have.length', eligibleCount);
        });
    });

    // Из явного запроса пользователя: доказать, что товары в списке —
    // реально купленные, а не фиктивные/захардкоженные. Сверяем по
    // numericId (UUID-поле products-for-reviews не матчится с числовым
    // product_id в orders_list, см. память проекта) с заказами в статусе
    // completed по всем страницам finished/active.
    it('Каждый товар из products-for-reviews — реальная завершённая покупка (сверка по numericId с orders_list)', () => {
        cabinetApi.getProductsForReviews().then(({ body }) => {
            const targetIds = body.products.map((p) => p.product.numericId);
            const statuses = ['finished', 'active'];
            const pagesPerStatus = 3;
            const limit = 50;
            const foundIds = new Set();

            const requests = [];
            statuses.forEach((status) => {
                for (let page = 1; page <= pagesPerStatus; page += 1) {
                    requests.push({ status, page });
                }
            });

            function checkNext(i) {
                if (i >= requests.length) return cy.wrap(null);
                const { status, page } = requests[i];
                return cabinetApi.getOrdersList({ status, page, limit }).then(({ body: ordersBody }) => {
                    // Форма ответа: {result, errors, data: {orders: [...]}} —
                    // сверено разведкой 2026-08-11.
                    const orders = ordersBody.data?.orders || [];
                    orders.forEach((order) => {
                        (order.basket?.items || []).forEach((item) => {
                            if (targetIds.includes(item.product_id) && order.current_status === 'completed') {
                                foundIds.add(item.product_id);
                            }
                        });
                    });
                    return checkNext(i + 1);
                });
            }

            checkNext(0).then(() => {
                targetIds.forEach((id) => {
                    expect(foundIds.has(id), `numericId ${id} должен встречаться среди completed-заказов`).to.be.true;
                });
            });
        });
    });
});

// Аудит 2026-08-11 по прямому запросу пользователя: сверка вкладки «Мои
// отзывы» с реальным ответом GET /v3/personal/reviews по каждому полю.
// Все проверенные поля (статус, рейтинг, дата, лайки/дизлайки, название
// товара, превью товара) отображаются корректно — см. тесты ниже. Текст
// отзыва, собственные фото отзыва (на десктопе) и теги изначально были
// заведены как BUG-035 (Jira AS-4561) — отклонён как не баг 2026-08-17
// (намеренное поведение, см. README.md этой папки), отдельных тестов на
// них больше нет.
//
// ВАЖНО (уточнение 2026-08-11): название товара и превью-картинка
// изначально ошибочно считались частью бага — на самом деле оба поля
// подгружаются АСИНХРОННО (отдельным запросом после первого рендера
// карточки) с задержкой в несколько секунд; при достаточном ожидании
// отображаются корректно. Первые ручные проверки просто не дожидались
// этой подгрузки.
describe('Отзывы — вкладка «Мои отзывы»: соответствие карточки данным API', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    const STATUS_LABEL = { published: 'Опубликован', moderation: 'На модерации', rejected: 'Отклонён' };
    const MONTHS_RU_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    function formatReviewDate(iso) {
        const d = new Date(iso);
        return `${d.getUTCDate()} ${MONTHS_RU_GENITIVE[d.getUTCMonth()]}`;
    }

    it('Статус, дата, суммарный рейтинг (звёзды) и лайки/дизлайки каждого отзыва совпадают с API', () => {
        cabinetApi.getPersonalReviewsV3().then(({ body }) => {
            expect(body.reviews, 'на аккаунте есть хотя бы 1 реальный отзыв').to.have.length.greaterThan(0);
            Reviews.visit();
            Reviews.getMyReviewsTab().click();
            cy.contains('Опубликован', { timeout: 10000 }).should('be.visible');

            body.reviews.forEach((review) => {
                if (STATUS_LABEL[review.status]) {
                    cy.contains(STATUS_LABEL[review.status]).should('be.visible');
                }
                cy.contains(formatReviewDate(review.createdAt)).should('be.visible');
            });

            // Суммарно заполненных звёзд (i-ph:star-fill, цвет
            // text-mi-text-warning) по всем карточкам должно быть ровно
            // столько, сколько сумма rating всех отзывов.
            const totalFilledStars = body.reviews.reduce((sum, r) => sum + r.rating, 0);
            cy.get('main .iconify.i-ph\\:star-fill.text-mi-text-warning').filter(':visible')
                .should('have.length', totalFilledStars);

            // Каждая иконка thumbs-up/thumbs-down несёт рядом число лайков/
            // дизлайков конкретного отзыва (сверено разведкой 2026-08-11) —
            // сверяем множество чисел карточек с множеством из API.
            cy.get('main .iconify.i-ph\\:thumbs-up-fill').filter(':visible')
                .then(($els) => $els.toArray().map((el) => parseInt(el.parentElement.textContent.trim(), 10)))
                .then((likesShown) => {
                    expect(likesShown.sort()).to.deep.equal(body.reviews.map((r) => r.likes).sort());
                });
            cy.get('main .iconify.i-ph\\:thumbs-down-fill').filter(':visible')
                .then(($els) => $els.toArray().map((el) => parseInt(el.parentElement.textContent.trim(), 10)))
                .then((dislikesShown) => {
                    expect(dislikesShown.sort()).to.deep.equal(body.reviews.map((r) => r.dislikes).sort());
                });
        });
    });

    // Название товара и превью-картинка подгружаются АСИНХРОННО (отдельным
    // запросом после первого рендера карточки) — cy.contains/cy.get retry
    // сами дожидаются появления, поэтому явного sleep не требуется —
    // изначально эти поля ошибочно считались частью BUG-035.
    it('Название и превью товара каждого отзыва совпадают с product.name/product.preview из API', () => {
        cabinetApi.getPersonalReviewsV3().then(({ body }) => {
            expect(body.reviews, 'на аккаунте есть хотя бы 1 реальный отзыв').to.have.length.greaterThan(0);
            Reviews.visit();
            Reviews.getMyReviewsTab().click();
            cy.contains('Опубликован', { timeout: 10000 }).should('be.visible');

            body.reviews.forEach((review) => {
                cy.contains(review.product.name, { timeout: 20000 }).should('be.visible');
                cy.get(`img[src="${review.product.preview}"]`, { timeout: 20000 }).should('be.visible')
                    .and(($img) => {
                        expect($img[0].naturalWidth, `превью «${review.product.name}» реально загрузилось`).to.be.greaterThan(0);
                    });
            });
        });
    });
});

// BUG-035 (Jira AS-4561, было заведено 2026-08-11): карточка отзыва на
// «Мои отзывы» не показывала текст отзыва, теги и собственные фото отзыва
// на десктопном viewport (текст и фото лежали внутри mobile-only
// `div.block.lg:hidden` без десктопного аналога; теги вообще не были в
// разметке). Отклонён как не баг 2026-08-17 — подтверждено пользователем,
// что скрытие этих полей на десктопе намеренное. Тикет переведён в
// «Готово», BugReport-файл удалён, три теста (текст/теги/фото) убраны
// полностью.
