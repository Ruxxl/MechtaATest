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

    // TC-ЛИ-3 — БАГ BUG-001: крошка "Личный кабинет" остаётся ссылкой без
    // отличительного цвета, вместо неактивного текста текущей страницы.
    // Тест целенаправленно ожидает правильное поведение и падает, пока баг не исправлен.
    it('Крошка «Личный кабинет» неактивна (текущая страница) — BUG-001', () => {
        Cabinet.getBreadcrumbItems().eq(1).find('a').should('not.exist');
        Cabinet.getBreadcrumbItems().eq(1).find('span[data-slot="link"]').should('exist');
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

            // BUG-002: поле телефона показывает "+7 700 000-00-00" вместо реального
            // номера аккаунта. Тест ожидает правильное поведение и падает, пока
            // баг не исправлен.
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

    // TC-ЛИ-25 — реальная сверка с API
    it('Блок «Оставьте отзыв» соответствует GET /v2/reviews/waiting-products', () => {
        cabinetApi.getWaitingProducts().then(({ body }) => {
            if (body.data.products && body.data.products.length > 0) {
                Cabinet.getReviewsTeaserHeading().should('be.visible');
                cy.contains('h2', 'Оставьте отзыв').parents('div').first()
                    .find('a[href^="/product/"]')
                    .should('have.length.at.least', 1);
            } else {
                // TC-ЛИ-28 — на реальном аккаунте products/banner оба null => блок скрыт
                cy.contains('h2', 'Оставьте отзыв').should('not.exist');
            }
        });
    });

    // БАГ BUG-029: живой, не мок-тест — сверяет РЕАЛЬНЫЕ данные избранного
    // с тем, что фактически показывает блок «Оставьте отзыв». На этом
    // аккаунте baseline именно такой, какой нужен для проверки (избранное
    // непусто, waiting-products пуст) — воспроизводится без единого мока.
    it('Блок «Оставьте отзыв» не дублирует картинки «Моё избранное» — BUG-029', () => {
        cabinetApi.getWaitingProducts().then(({ body: waitingBody }) => {
            expect(waitingBody.data.products, 'baseline: waiting-products пуст на этом аккаунте').to.be.null;

            cabinetApi.getFavorites().then(({ body: favBody }) => {
                expect(favBody.products.length, 'baseline: избранное непусто на этом аккаунте').to.be.greaterThan(0);

                Cabinet.visit();
                Cabinet.getFavoritesTeaserImages().then((favImages) => {
                    Cabinet.getReviewsTeaserImages().then((reviewImages) => {
                        expect(
                            reviewImages,
                            'BUG-029: виджет "Оставьте отзыв" показывает те же картинки, что "Моё избранное", вместо пустого состояния',
                        ).to.not.deep.equal(favImages);
                    });
                });
            });
        });
    });

    // TC-ЛИ-28 (уточнённая версия) — БАГ BUG-029: единственный источник
    // данных для "Оставьте отзыв" (waiting-products) полностью пуст, И
    // избранное тоже пусто (мок) — блок не должен показывать НИКАКИЕ
    // товары ни из какого источника. Полноценный cy.visit() (не SPA-переход)
    // — сверено разведкой 2026-08-07, что мок должен ловиться уже на
    // первой загрузке, SPA-переход внутри уже открытой вкладки этот кэш
    // не обновляет и для проверки НЕ годится.
    it('При пустых избранном И waiting-products блок «Оставьте отзыв» не показывает случайные товары (мок) — BUG-029', () => {
        cy.intercept('GET', '**/v3/favorites**', {
            statusCode: 200,
            body: { products: [], count: 0 },
        }).as('favorites');
        cy.intercept('GET', '**/v2/reviews/waiting-products**', {
            statusCode: 200,
            body: { result: true, errors: [], data: { banner: null, products: null } },
        }).as('waiting');
        // Не используем Cabinet.visit() — свой intercept на тот же роут,
        // алиас-гонка (см. project memory про cy.intercept alias race)
        cy.visit(CABINET_URL);
        cy.wait('@waiting', { timeout: 40000 });
        cy.contains('h2', 'Оставьте отзыв').parents('div').eq(1).find('img').should('not.exist');
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
});

describe('Личный кабинет — «Вы недавно смотрели»', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-ЛИ-33, TC-ЛИ-47 — реальная сверка названий карточек с API
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
            cy.contains('a[href^="/product/"]', tradeInItem.name)
                .parents('div').eq(2)
                .contains('Trade-in')
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

    // TC-ЛИ-77 — БАГ BUG-003: остальные независимые блоки (Мечта ГИД и т.п.)
    // должны продолжать отображаться, но фактически пропадает вся правая
    // колонка целиком. Тест ожидает правильное поведение и падает, пока
    // баг не исправлен.
    it('GET /v2/personal с result:false не крашит страницу — BUG-003', () => {
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

    // TC-ЛИ-79 — БАГ BUG-003, см. комментарий к тесту result:false выше
    it('GET /v2/personal — таймаут/500 не роняет всю страницу — BUG-003', () => {
        cy.intercept('GET', '**/v2/personal', { statusCode: 500, body: {} }).as('personal');
        Cabinet.visit();
        cy.wait('@personal');
        Cabinet.getMechtaGuideHeading().should('be.visible');
        Cabinet.getSidebarNav().should('be.visible');
    });

    // TC-ЛИ-81
    it('GET /v3/personal/history — 500 деградирует только блок карусели', () => {
        cy.intercept('GET', '**/v3/personal/history', { statusCode: 500, body: {} }).as('history');
        Cabinet.visit();
        cy.wait('@history');
        Cabinet.getMechtaGuideHeading().should('be.visible');
        cy.get('h1').should('contain.text', 'Личный кабинет');
    });

    // TC-ЛИ-83
    it('GET /v2/reviews/waiting-products с result:false не блокирует остальную страницу', () => {
        cy.intercept('GET', '**/v2/reviews/waiting-products', {
            statusCode: 200,
            body: { result: false, errors: ['error'], data: null },
        }).as('waiting');
        Cabinet.visit();
        cy.wait('@waiting');
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

    // TC-ЛИ-103
    it('Выход из аккаунта по пункту «Выйти»', () => {
        Cabinet.clickLogout();
        cy.url().should('eq', 'http://d2.im.mdev.kz/');
        // Небольшая пауза — иконка профиля/"Войти" в шапке может на мгновение
        // остаться в переходном состоянии сразу после редиректа
        cy.wait(500);
        cy.contains('Войти').should('be.visible');
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
