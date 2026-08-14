import CabinetPage, { CABINET_URL } from '../../../support/pageObjects/cabinetPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Cabinet = new CabinetPage();

// Личный кабинет — обзорная страница /cabinet/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Личный кабинет",
// TC-ЛИ-1..124). Стенд использует ОТДЕЛЬНЫЙ бэкенд http://api.d.im.mdev.kz,
// не www.mechta.kz — см. cypress/support/helpers/cabinetApi.js.

describe('Личный кабинет — Хлебные крошки', () => {
    beforeEach(() => {
        cy.loginD2();
        Cabinet.visit();
    });

    // TC-ЛИ-1
    it('Отображение хлебных крошек на странице ЛК', () => {
        Cabinet.getBreadcrumbItems().should('have.length', 2);
        Cabinet.getBreadcrumbItems().eq(0).should('contain.text', 'Главная');
        Cabinet.getBreadcrumbItems().eq(1).should('contain.text', 'Личный кабинет');
    });

    // TC-ЛИ-2
    it('Переход по крошке «Главная»', () => {
        Cabinet.getBreadcrumbItems().eq(0).find('a').click();
        cy.url().should('eq', 'http://d2.im.mdev.kz/');
    });

    // TC-ЛИ-3 — BUG-001 ПОЛНОСТЬЮ ИСПРАВЛЕН (подтверждено 2026-08-12,
    // Jira AS-4503 → «Готово»): крошка больше не <a>, и цвет теперь тоже
    // соответствует эталонному паттерну других страниц (акцентный
    // rgba(0,0,0,0.85), как «Мои заказы» на /cabinet/orders/, а не серый
    // rgba(0,0,0,0.5) как у «Главная») — тест усилен проверкой цвета.
    it('Крошка «Личный кабинет» неактивна (текущая страница)', () => {
        Cabinet.getBreadcrumbItems().eq(1).find('a').should('not.exist');
        Cabinet.getBreadcrumbItems().eq(1).find('span[data-slot="link"]').should('exist');
        Cabinet.getBreadcrumbItems().eq(1).find('[data-slot="linkLabel"]').should(($label) => {
            const color = window.getComputedStyle($label[0]).color;
            expect(color, 'цвет текущей крошки — акцентный, отличается от обычной ссылки').to.eq('rgba(0, 0, 0, 0.85)');
        });
    });
});

describe('Личный кабинет — Заголовок страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Cabinet.visit();
    });

    // TC-ЛИ-4
    it('Отображение заголовка «Личный кабинет»', () => {
        Cabinet.getH1().should('have.length', 1).and('have.text', 'Личный кабинет');
    });
});

describe('Личный кабинет — Блок профиля (ФИО, телефон, баланс)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ЛИ-5, TC-ЛИ-6, TC-ЛИ-9, TC-ЛИ-11 — сверка с реальным API одним проходом
    it('ФИО, телефон и баланс на странице соответствуют GET /v2/personal', () => {
        cabinetApi.getPersonal().then(({ body }) => {
            const { profile_info, bonus_info, chips_info } = body.data;

            Cabinet.visit();

            cy.get('h2').first().should('have.text', profile_info.full_name);

            // Телефон в API приходит без форматирования (напр. "0000000000"),
            // на UI ожидается формат +7 XXX XXX XX XX
            const digits = profile_info.phone.replace(/\D/g, '');
            const formatted = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
            cy.contains(formatted).should('be.visible');

            cy.contains('Ваш баланс').should('be.visible');
            cy.get('h2').contains(String(bonus_info.active)).should('be.visible');
            cy.get('h2').contains(String(chips_info.active)).should('be.visible');
            cy.contains('бонусов').should('be.visible');
            cy.contains('фишек').should('be.visible');
        });
    });

    // TC-ЛИ-10, TC-ЛИ-12 — на этом тестовом аккаунте бонусы и фишки реально равны 0,
    // что и есть требуемый негативный сценарий "баланс = 0" без моков
    it('Баланс = 0 отображается как «0», а не пусто/ошибка (реальные данные аккаунта)', () => {
        cabinetApi.getPersonal().then(({ body }) => {
            expect(body.data.bonus_info.active, 'baseline: аккаунт с 0 бонусов').to.eq(0);
            expect(body.data.chips_info.active, 'baseline: аккаунт с 0 фишек').to.eq(0);
        });
        Cabinet.visit();
        cy.contains('Ваш баланс').parents('div').first().within(() => {
            cy.get('h2').should('have.length.at.least', 2).each(($h) => {
                cy.wrap($h).should('have.text', '0');
            });
        });
    });

    // TC-ЛИ-7, TC-ЛИ-8 — включая проверку BUG-002 (неверный телефон в панели)
    it('Клик на блок профиля открывает панель редактирования с корректно предзаполненными полями', () => {
        cabinetApi.getPersonal().then(({ body }) => {
            const { profile_info } = body.data;
            Cabinet.visit();
            Cabinet.openEditProfilePanel();

            Cabinet.getEditProfileModalHeading().should('be.visible');
            cy.get('input[name="firstname"]').should('not.have.value', '');
            cy.get('input[name="lastname"]').should('not.have.value', '');
            // ВАЖНО: input[name="email"] неоднозначен — на странице ДВА таких поля:
            // форма подписки на рассылку в футере (всегда пустая) и это поле в
            // модалке. Модалка порталится в конец <body>, поэтому её поле —
            // последнее совпадение по document order (сверено разведкой 2026-08-06).
            cy.get('input[name="email"]').last().should('have.value', profile_info.email);

            // BUG-002 ИСПРАВЛЕН (2026-08-10): раньше поле телефона показывало
            // захардкоженное "+7 700 000-00-00" вместо реального номера — теперь
            // корректно предзаполнено реальными данными аккаунта.
            const digits = profile_info.phone.replace(/\D/g, '');
            const formatted = `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
            cy.get('input[name="contact_phone"]').should('have.value', formatted);
        });
    });

    // TC-ЛИ-113 — закрытие не крестиком, а по Esc/клику вне модалки
    it('Панель редактирования профиля закрывается по Esc', () => {
        Cabinet.visit();
        Cabinet.openEditProfilePanel();
        Cabinet.getEditProfileModalHeading().should('be.visible');
        // Небольшая пауза перед Esc — модалка анимированно открывается,
        // мгновенный Esc может прийтись на середину transition
        cy.wait(500);
        Cabinet.closeEditProfilePanel();
        Cabinet.getEditProfileModalHeading().should('not.exist');
    });
});

describe('Личный кабинет — Сгорание бонусов и фишек', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ЛИ-15, TC-ЛИ-17 — на реальном тестовом аккаунте nearest_expiration_date
    // пустой и для бонусов, и для фишек => блок должен быть скрыт
    it('Блок «X сгорят» скрыт, если nearest_expiration_date пуст (реальные данные)', () => {
        cabinetApi.getBonusesHistory().then(({ body }) => {
            expect(body.data.all_data.nearest_expiration_date, 'baseline: нет сгорающих бонусов').to.eq('');
            expect(body.data.chips.nearest_expiration_date, 'baseline: нет сгорающих фишек').to.eq('');
        });
        Cabinet.visit();
        cy.contains(/сгор[ия]т/).should('not.exist');
        // Верстка не ломается — баланс всё равно виден
        cy.contains('Ваш баланс').should('be.visible');
    });
});

describe('Личный кабинет — Блоки «Моё избранное», «Оставьте отзыв», «Мечта ГИД»', () => {
    beforeEach(() => {
        cy.loginD2();
        Cabinet.visit();
    });

    // TC-ЛИ-25/28 — ПЕРЕСМОТРЕНО ПОВТОРНО (2026-08-10, живая разведка): блок
    // дашборда прошёл ещё одну редизайн-итерацию после того, как плитки были
    // "статичные, без картинок" (см. историю BUG-029 в README этой папки).
    // Сейчас ОБЕ плитки на /cabinet/ снова рендерят превью товаров-карточек
    // — но, в отличие от исходного BUG-029 (2026-08-07), уже из ПРАВИЛЬНЫХ,
    // РАЗНЫХ источников: «Оставьте отзыв» — из GET
    // /v3/personal/products-for-reviews, «Моё избранное» — из GET
    // /v3/favorites, без пересечения картинок между ними.
    it('Плитка «Оставьте отзыв» показывает превью товаров из products-for-reviews, БЕЗ пересечения с «Моё избранное» — BUG-029 исправлен', () => {
        cabinetApi.getProductsForReviews().then(({ body: reviewBody }) => {
            cabinetApi.getFavorites().then(({ body: favBody }) => {
                const reviewImages = reviewBody.products.map((p) => p.product.preview);
                const favImages = favBody.products.map((p) => p.preview);
                expect(reviewImages.length, 'baseline: есть товары к отзыву').to.be.greaterThan(0);
                expect(favImages.length, 'baseline: есть избранное').to.be.greaterThan(0);

                Cabinet.visit();
                cy.contains('h2', 'Оставьте отзыв').should('be.visible')
                    .parents('div').first().find('img').should(($imgs) => {
                        expect($imgs.length, 'плитка рендерит хотя бы одно превью товара').to.be.greaterThan(0);
                        [...$imgs].forEach((img) => {
                            expect(reviewImages, `превью ${img.src} принадлежит products-for-reviews`).to.include(img.src);
                            expect(favImages, `превью ${img.src} НЕ является картинкой из избранного`).to.not.include(img.src);
                        });
                    });
            });
        });
    });

    // TC-ЛИ-30
    it('Блок «Мечта ГИД» отображается со статичным текстом и кнопкой', () => {
        Cabinet.getMechtaGuideHeading().should('be.visible');
        cy.contains('Раздел с ответами и полезной информацией').should('be.visible');
        cy.contains('button, a', 'Открыть Мечта Гид').should('be.visible');
    });

    // TC-ЛИ-32
    it('Переход по кнопке «Открыть Мечта Гид» ведёт на /faq/', () => {
        cy.contains('Открыть Мечта Гид').click();
        cy.url().should('include', '/faq/');
    });

    // TC-ЛИ-23
    it('Клик по заголовку «Моё избранное» ведёт на страницу избранного', () => {
        Cabinet.getFavoritesTeaserHeading().click();
        cy.url().should('include', '/favorites/');
    });

    // Добавлено 2026-08-10 взамен удалённых BUG-029-тестов — раз плитка
    // теперь чисто навигационная (см. комментарий выше), стоит явно
    // покрыть, куда она ведёт.
    it('Клик по плитке «Оставьте отзыв» ведёт на /cabinet/reviews/', () => {
        Cabinet.getReviewsTeaserHeading().click();
        cy.url().should('include', '/cabinet/reviews/');
    });
});

describe('Личный кабинет — «Вы недавно смотрели»', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ЛИ-33, TC-ЛИ-47 — реальная сверка названий карточек с API.
    // ИЗВЕСТНАЯ ГОНКА (см. project memory про live-data race, аналог
    // TC-МО-18/63 в orders.cy.js): изредка падает в ПОЛНОМ прогоне файла,
    // когда более ранние тесты в этом же файле кликают по товарам (тем
    // самым добавляя их в "Вы недавно смотрели") — новый просмотр может
    // попасть в API чуть позже, чем ожидает этот тест. В изоляции проходит
    // стабильно (проверено 3/3 повторов 2026-08-10). Не баг фронта.
    it('Карусель отображает товары, названия соответствуют GET /v3/personal/history', () => {
        cabinetApi.getHistory().then(({ body }) => {
            const items = body.data || body;
            expect(items.length, 'baseline: есть история просмотров').to.be.greaterThan(0);

            Cabinet.visit();
            Cabinet.getRecentlyViewedHeading().should('be.visible');

            const firstName = items[0].name;
            cy.contains('a[href^="/product/"]', firstName).should('be.visible');
        });
    });

    // TC-ЛИ-55, TC-ЛИ-56 — цена со скидкой и без, сверка с prices.basePrice/finalPrice
    it('Цена со скидкой и без скидки соответствуют полям prices из API', () => {
        cabinetApi.getHistory().then(({ body }) => {
            const items = body.data || body;
            const withDiscount = items.find((i) => i.prices && i.prices.discount > 0);
            const withoutDiscount = items.find((i) => i.prices && i.prices.discount === 0);

            Cabinet.visit();

            if (withDiscount) {
                const finalFormatted = withDiscount.prices.finalPrice.toLocaleString('ru-RU').replace(/,/g, ' ');
                cy.contains('a[href^="/product/"]', withDiscount.name)
                    .parents('div').eq(2)
                    .should('contain.text', finalFormatted);
            }
            if (withoutDiscount) {
                cy.contains('a[href^="/product/"]', withoutDiscount.name)
                    .parents('div').eq(2)
                    .find('[class*="line-through"], del, s')
                    .should('not.exist');
            }
        });
    });

    // TC-ЛИ-39 — стикер Trade-in
    it('Товар с tradeInAvailable: true показывает стикер «Trade-in»', () => {
        cabinetApi.getHistory().then(({ body }) => {
            const items = body.data || body;
            const tradeInItem = items.find((i) => i.tradeInAvailable === true);
            if (!tradeInItem) {
                cy.log('На аккаунте нет товара с tradeInAvailable:true — кейс пропущен, нужны мок-данные');
                return;
            }
            Cabinet.visit();
            // Карусель горизontально скроллится, overflow:hidden на контейнере —
            // товар с Trade-in может быть не первым и физически не попадать в
            // видимую область, пока карусель не проскроллена до него (это
            // нормальное поведение карусели, не баг). scrollIntoView() перед
            // проверкой видимости, а не голый .should('be.visible').
            cy.contains('a[href^="/product/"]', tradeInItem.name)
                .parents('div').eq(2)
                .contains('Trade-in')
                .scrollIntoView()
                .should('be.visible');
        });
    });

    // TC-ЛИ-42 — количество точек пагинации соответствует images.length
    it('Количество точек-индикаторов карточки соответствует images.length', () => {
        cabinetApi.getHistory().then(({ body }) => {
            const items = body.data || body;
            const multiImage = items.find((i) => i.images && i.images.length > 1);
            if (!multiImage) {
                cy.log('На аккаунте нет товара с несколькими изображениями — кейс пропущен');
                return;
            }
            Cabinet.visit();
            // Точки — это <div class="rounded-full ..."> внутри
            // <section class="...cursor-pointer">, НЕ кнопки (сверено разведкой
            // 2026-08-06 через дамп реального DOM карточки)
            cy.contains('a[href^="/product/"]', multiImage.name)
                .parents('div').eq(2)
                .find('section.cursor-pointer > div.rounded-full')
                .should('have.length', multiImage.images.length);
        });
    });

    // TC-ЛИ-74 — переход по клику на карточку
    it('Клик по карточке товара открывает страницу товара', () => {
        Cabinet.visit();
        Cabinet.getRecentlyViewedCards().first().invoke('attr', 'href').then((href) => {
            Cabinet.getRecentlyViewedCards().first().click();
            cy.url().should('include', href);
        });
    });

    // Базовый шаблон объекта товара для /v3/personal/history — сверен с реальным
    // ответом API 2026-08-06 (curl): ответ — СЫРОЙ массив (без обёртки
    // {result,errors,data}), discount — поле НА ВЕРХНЕМ уровне объекта товара,
    // а не внутри prices. Ранняя версия этих тестов использовала неверную форму
    // (обёртку data[] и discount внутри prices) по догадке из тест-плана, без
    // проверки — из-за этого мок не распознавался фронтом и тесты падали.
    function mockHistoryItem(overrides = {}) {
        return {
            id: 'mock-1',
            name: 'Мок-товар',
            slug: 'mock-tovar',
            code: 'mock-code',
            numericId: 1,
            images: ['https://placehold.co/200'],
            preview: null,
            availability: 'available',
            preorder: null,
            prices: { basePrice: 100000, finalPrice: 100000 },
            discount: 0,
            credit: null,
            stickers: [],
            mainProperties: null,
            categories: [],
            rating: { averageRating: 4.5, reviewsCount: 3 },
            userFlags: { inBasket: false, inFavorite: false, inCompare: false },
            shipment: null,
            propertyGroups: null,
            metrics: { name: 'Мок-товар', brand: 'Mock', category: 'Mock' },
            onlyShopwindow: false,
            tradeInAvailable: false,
            chipsPromotion: null,
            productType: 'DefaultProductType',
            defectiveInfo: null,
            guaranteeServiceTypes: { sp: false, mms: false },
            freeInstallation: false,
            ...overrides,
        };
    }

    // TC-ЛИ-38 — мок-данные: разные величины бонусного стикера форматируются
    // с разделителем разрядов.
    // ВАЖНО: тест-план (TC-ЛИ-36..41) предполагает, что стикер "+X Б" на
    // карточке управляется полем chipsPromotion из /v3/personal/history —
    // это ОПРОВЕРГНУТО разведкой 2026-08-06: на реальном тестовом аккаунте
    // ВСЕ 11 товаров в истории имеют chipsPromotion:null, включая те, что
    // визуально показывают "+X Б" (напр. Кондиционер MIDEA — null, но на
    // карточке видно "+ 4 500 Б"). Реальный источник — отдельный запрос
    // GET /v3/catalog/offers?productIds[]=..., поле `bonuses` (для MIDEA:
    // bonuses:4499 → на карточке округляется до "+ 4 500"). Мокаем оба
    // эндпоинта согласно фактическому контракту.
    it('Стикер бонусов «+X Б» форматируется с разделителем разрядов (мок)', () => {
        const mockId = 'mock-1';
        cy.intercept('GET', '**/v3/personal/history', {
            statusCode: 200,
            body: [mockHistoryItem({ id: mockId, name: 'Мок-товар с большим бонусом' })],
        }).as('history');
        cy.intercept('GET', '**/v3/catalog/offers**', {
            statusCode: 200,
            body: [{
                productId: mockId,
                bonuses: 999999,
                chips: 0,
                discount: 0,
                credit: null,
                prices: { basePrice: 100000, finalPrice: 100000 },
                gifts: null,
            }],
        }).as('offers');
        Cabinet.visit();
        cy.wait('@history');
        cy.wait('@offers');
        cy.contains('999 999').should('be.visible');
    });

    // TC-ЛИ-61 — мок-данные: некорректная цена (0/отрицательная) не должна
    // показываться как реальная цена без пояснения
    it('Некорректная цена (0 или отрицательная) не отображается как есть (мок)', () => {
        cy.intercept('GET', '**/v3/personal/history', {
            statusCode: 200,
            body: [mockHistoryItem({
                name: 'Мок-товар с некорректной ценой',
                prices: { basePrice: 0, finalPrice: -100 },
                rating: { averageRating: 0, reviewsCount: 0 },
            })],
        }).as('history');
        Cabinet.visit();
        cy.wait('@history');
        // Фиксируем фактическое поведение: цена не должна показываться как "-100 ₸"
        cy.contains('-100').should('not.exist');
    });
});

describe('Личный кабинет — Негативные сценарии (обработка ошибок API)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ЛИ-77 — BUG-003 ИСПРАВЛЕН ЧАСТИЧНО (2026-08-10): раньше при ошибке
    // /v2/personal пропадала ВСЯ правая колонка целиком (включая полностью
    // независимые от неё блоки) — это исправлено, остальные блоки (Мечта ГИД
    // и т.п.) корректно продолжают отображаться. НО остаётся более узкий
    // BUG-033: в блоке профиля (сайдбар) вторая строка под именем буквально
    // показывает текст "undefined" вместо пустоты/skeleton. Тест ниже
    // намеренно продолжает падать на этом — assert зафиксирован как
    // ожидаемое (правильное) поведение, тест должен сам стать зелёным, когда
    // BUG-033 исправят.
    it('GET /v2/personal с result:false не крашит страницу', () => {
        cy.intercept('GET', '**/v2/personal', {
            statusCode: 200,
            body: { result: false, errors: ['Внутренняя ошибка'], data: null },
        }).as('personal');
        Cabinet.visit();
        cy.wait('@personal');
        // Остальные независимые блоки должны продолжать работать
        Cabinet.getMechtaGuideHeading().should('be.visible');
        // Не должно быть текста "null"/"undefined" в блоке профиля.
        // ВАЖНО: проверяем именно <main>, а не <body> целиком — <body> включает
        // текстовое содержимое инлайн-<script> тегов аналитики (там буквально
        // встречаются строки "undefined"/"null" как часть JS-кода), что даёт
        // ложное срабатывание, не имеющее отношения к реальному UI.
        // BUG-033: пока падает здесь — блок профиля рендерит "undefined".
        cy.get('main').should('not.contain.text', 'undefined');
    });

    // TC-ЛИ-78
    it('GET /v2/personal с profile_info.full_name: null не показывает "null" на UI', () => {
        cy.intercept('GET', '**/v2/personal', (req) => {
            req.continue((res) => {
                if (res.body && res.body.data) {
                    res.body.data.profile_info.full_name = null;
                }
            });
        }).as('personal');
        Cabinet.visit();
        cy.wait('@personal');
        // См. комментарий выше про <main> vs <body>
        cy.get('main').should('not.contain.text', 'null');
    });

    // TC-ЛИ-79 — BUG-003 ИСПРАВЛЕН ЧАСТИЧНО, см. комментарий к тесту result:false
    // выше. Живьём подтверждено, что BUG-033 ("undefined" в блоке профиля)
    // воспроизводится и на голой 500-ошибке (не только на result:false),
    // поэтому та же проверка добавлена и сюда.
    it('GET /v2/personal — таймаут/500 не роняет всю страницу', () => {
        cy.intercept('GET', '**/v2/personal', { statusCode: 500, body: {} }).as('personal');
        Cabinet.visit();
        cy.wait('@personal');
        Cabinet.getMechtaGuideHeading().should('be.visible');
        Cabinet.getSidebarNav().should('be.visible');
        // BUG-033: пока падает здесь тоже — блок профиля рендерит "undefined".
        cy.get('main').should('not.contain.text', 'undefined');
    });

    // TC-ЛИ-81
    it('GET /v3/personal/history — 500 деградирует только блок карусели', () => {
        cy.intercept('GET', '**/v3/personal/history', { statusCode: 500, body: {} }).as('history');
        Cabinet.visit();
        cy.wait('@history');
        Cabinet.getMechtaGuideHeading().should('be.visible');
        cy.get('h1').should('contain.text', 'Личный кабинет');
    });

    // TC-ЛИ-83 — мигрировано (2026-08-10) на GET /v3/personal/products-for-reviews,
    // тот же эндпоинт, что и виджет «Оставьте отзыв» реально вызывает
    // (старый /v2/reviews/waiting-products фронт больше не вызывает вовсе,
    // тест падал с "No request ever occurred").
    it('GET /v3/personal/products-for-reviews с ошибкой не блокирует остальную страницу', () => {
        cy.intercept('GET', '**/v3/personal/products-for-reviews', {
            statusCode: 500,
            body: {},
        }).as('productsForReviews');
        Cabinet.visit();
        cy.wait('@productsForReviews');
        cy.get('h1').should('contain.text', 'Личный кабинет');
        Cabinet.getMechtaGuideHeading().should('be.visible');
    });
});

describe('Личный кабинет — Боковое меню, навигация', () => {
    beforeEach(() => {
        cy.loginD2();
        Cabinet.visit();
    });

    // TC-ЛИ-91, TC-ЛИ-92 — фактический порядок пунктов меню на стенде отличается
    // от ТЗ (нет пункта "Мои карты" в ТЗ; "Отзывы" на стенде идёт до разделителя,
    // "Избранное"/"Сравнение" — после). Тест-план сам фиксирует это расхождение
    // как открытый вопрос к аналитику — здесь просто документируем фактическое
    // поведение стенда, не считаем багом.
    it('Пункты бокового меню отображаются в порядке, соответствующем стенду', () => {
        Cabinet.getSidebarNav().find('li').then(($items) => {
            const texts = [...$items].map((el) => el.textContent.trim());
            expect(texts).to.deep.equal([
                'Личный кабинет',
                'Мои заказы',
                'Цифровые товары',
                'Бонусы и фишки',
                'Мои карты',
                'Купоны',
                'Отзывы',
                'Избранное',
                'Сравнение',
                'Выйти',
            ]);
        });
    });

    // TC-ЛИ-94, TC-ЛИ-96..101 — переходы по пунктам меню
    const menuTargets = [
        { text: 'Мои заказы', urlPart: '/cabinet/orders/' },
        { text: 'Бонусы и фишки', urlPart: '/cabinet/bonuses/' },
        { text: 'Мои карты', urlPart: '/cabinet/cards/' },
        { text: 'Купоны', urlPart: '/cabinet/coupons/' },
        { text: 'Отзывы', urlPart: '/cabinet/reviews/' },
        { text: 'Избранное', urlPart: '/favorites/' },
        { text: 'Сравнение', urlPart: '/compare/' },
    ];

    menuTargets.forEach(({ text, urlPart }) => {
        it(`Переход по пункту меню «${text}»`, () => {
            Cabinet.clickSidebarItem(text);
            cy.url().should('include', urlPart);
        });
    });

    // TC-ЛИ-102 — активный пункт визуально выделен. Классы на самих <li>/<a>
    // одинаковы у всех пунктов (утилитарные, общие) — реальная подсветка
    // сидит на ВЛОЖЕННОМ <div> (класс с фоном добавляется только у активного
    // пункта) — сверено разведкой 2026-08-06 через elementFromPoint.
    it('Активный пункт меню «Личный кабинет» визуально выделен (фон отличается от соседних)', () => {
        Cabinet.getSidebarNav().contains('li', 'Личный кабинет').find('div').first()
            .should(($active) => {
                const activeBg = window.getComputedStyle($active[0]).backgroundColor;
                expect(activeBg, 'фон активного пункта не должен быть прозрачным').to.not.eq('rgba(0, 0, 0, 0)');
            });
        Cabinet.getSidebarNav().contains('li', 'Мои заказы').find('div').first()
            .should(($inactive) => {
                const inactiveBg = window.getComputedStyle($inactive[0]).backgroundColor;
                expect(inactiveBg, 'фон неактивного пункта должен быть прозрачным').to.eq('rgba(0, 0, 0, 0)');
            });
    });

    // TC-ЛИ-103 — только UI сразу после редиректа, БЕЗ reload. Из-за
    // BUG-034 (см. ниже) сам по себе флейков: иногда шапка сразу после
    // редиректа ещё показывает старое состояние, а к моменту проверки
    // успевает обновиться визуально, даже если сессия на бэке жива.
    it('Выход из аккаунта по пункту «Выйти»', () => {
        Cabinet.clickLogout();
        cy.url().should('eq', 'http://d2.im.mdev.kz/');
        // Небольшая пауза — иконка профиля/"Войти" в шапке может на мгновение
        // остаться в переходном состоянии сразу после редиректа
        cy.wait(500);
        cy.contains('Войти').should('be.visible');
    });

    // BUG-034 (Jira AS-4555 → «Код ревью», ошибочно закрывался в «Готово»
    // 2026-08-12 и был откачен обратно): POST /v2/logout отвечает 200
    // {result:true}, но сессия на бэкенде иногда НЕ инвалидируется — после
    // reload прямой заход на /cabinet/ снова показывает реальные данные
    // аккаунта. Живой разведкой (2026-08-10, 16 повторов через 4 отдельных
    // прогона) воспроизведено примерно в 11/16 случаев. Первая перепроверка
    // 2026-08-12 (16 повторов БЫСТРЫМИ fetch() без полной загрузки страницы
    // между шагами) дала ложные 0/16 — race зависит от реального времени
    // между logout и следующим запросом, быстрый цикл его не задевает.
    // Вторая перепроверка — тем же реалистичным сценарием, что и здесь
    // (полный визит + клик по UI + reload + повторный визит), но с прямой
    // проверкой через cy.request('GET', '/v2/personal') — дала 4/8 (50%)
    // отказов, баг подтверждён живым.
    //
    // ВАЖНО: детекция «залогинен ли пользователь» ЗДЕСЬ раньше проверяла
    // ТЕКСТ страницы ($body.text().includes('Ваш баланс')/'Авторизуйтесь') —
    // это оказалось НЕНАДЁЖНЫМ индикатором: в перепроверке 2026-08-12 текст
    // страницы разошёлся с реальным ответом GET /v2/personal в 3 из 8
    // попыток (в обе стороны) — UI-рендер /cabinet/ не всегда успевает
    // показать актуальное состояние в течение окна наблюдения теста, из-за
    // чего текстовая детекция СИСТЕМАТИЧЕСКИ НЕДООЦЕНИВАЛА частоту бага.
    // Переписано на прямую проверку через API — это и есть источник истины
    // (см. BUG-034.md, секция «Методологическое уточнение»).
    it('После «Выйти» + reload сессия реально завершена на бэкенде (несколько попыток) — BUG-034', () => {
        const attempts = 4;
        let stillLoggedInCount = 0;

        function oneAttempt(i) {
            cy.loginD2();
            Cabinet.visit();
            cy.intercept('POST', '**/v2/logout**').as('logoutReqPost');
            Cabinet.clickLogout();
            cy.wait('@logoutReqPost', { timeout: 15000 });
            cy.url().should('eq', 'http://d2.im.mdev.kz/');
            cy.reload();
            cy.wait(1200);
            cy.visit(CABINET_URL, { failOnStatusCode: false });
            cy.wait(1500);
            // Источник истины — прямой запрос к /v2/personal, НЕ текст
            // страницы (ненадёжен, см. комментарий выше).
            cy.request({ url: 'http://api.d.im.mdev.kz/v2/personal', headers: { Accept: 'application/json' }, failOnStatusCode: false })
                .then((res) => {
                    const stillLoggedIn = res.status === 200 && res.body?.result === true;
                    if (stillLoggedIn) {
                        stillLoggedInCount += 1;
                        cy.log(`попытка ${i}: сессия ЖИВА после reload (BUG-034) — GET /v2/personal вернул ${res.status}`);
                    } else {
                        cy.log(`попытка ${i}: сессия корректно завершена — GET /v2/personal вернул ${res.status}`);
                    }
                });
        }

        for (let i = 0; i < attempts; i += 1) {
            oneAttempt(i);
        }

        cy.then(() => {
            expect(
                stillLoggedInCount,
                `BUG-034: сессия осталась активной после «Выйти»+reload в ${stillLoggedInCount}/${attempts} попытках (ожидается 0/${attempts})`,
            ).to.eq(0);
        });
    });
});

describe('Личный кабинет — Авторизация и доступ к разделу', () => {
    // TC-ЛИ-118 — прямой заход на /cabinet/ без авторизации.
    // Поведение стенда не было заранее известно — проверяем и документируем факт.
    it('Переход на /cabinet/ без авторизации не показывает чужие данные профиля', () => {
        cy.clearCookies();
        cy.visit(CABINET_URL, { failOnStatusCode: false });
        // Вне зависимости от конкретного UX (редирект/модалка/пустое состояние),
        // персональные данные авторизованного пользователя не должны быть видны
        cy.contains('Джон Appleseed').should('not.exist');
    });
});
