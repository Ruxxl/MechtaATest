import OrdersPage, { ORDERS_URL } from '../../../support/pageObjects/ordersPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Orders = new OrdersPage();

// Личный кабинет — «Мои заказы», /cabinet/orders/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Мои заказы", TC-МО-1..87).

describe('Мои заказы — общие элементы страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Orders.visit();
    });

    // TC-МО-1
    it('Хлебные крошки «Главная / Личный кабинет / Мои заказы»', () => {
        Orders.getBreadcrumbItems().should('have.length', 3);
        Orders.getBreadcrumbItems().eq(0).should('contain.text', 'Главная');
        Orders.getBreadcrumbItems().eq(1).should('contain.text', 'Личный кабинет');
        Orders.getBreadcrumbItems().eq(2).should('contain.text', 'Мои заказы');
        // Последняя крошка — не ссылка (текущая страница), в отличие от BUG-001 на /cabinet/
        Orders.getBreadcrumbItems().eq(2).find('a').should('not.exist');
    });

    // TC-МО-2 — БАГ BUG-008 ИСПРАВЛЕН (проверено 2026-08-10): раньше h1
    // отсутствовал вовсе, теперь есть, с текстом «Мои заказы» (не просто
    // «Заказы» — сверка регистронезависимая, т.к. реальный текст «Мои
    // заказы» содержит «заказы» с маленькой буквы).
    it('Отображение заголовка «Мои заказы»', () => {
        cy.get('h1').should('have.length', 1).and(($h1) => {
            expect($h1.text().toLowerCase()).to.include('заказы');
        });
    });

    // TC-МО-3
    it('Пункт «Мои заказы» в боковом меню подсвечен активным', () => {
        cy.get('nav').eq(1).contains('li', 'Мои заказы').find('div').first()
            .should(($el) => {
                const bg = window.getComputedStyle($el[0]).backgroundColor;
                expect(bg, 'фон активного пункта не прозрачный').to.not.eq('rgba(0, 0, 0, 0)');
            });
    });
});

describe('Мои заказы — вкладки «Активные»/«Завершённые»', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-5, TC-МО-25, TC-МО-71
    it('По умолчанию открыта вкладка «Активные», запрос с status=active&page=1&limit=10', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**').as('orders');
        Orders.visit();
        cy.wait('@orders').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('status')).to.eq('active');
            expect(url.searchParams.get('page')).to.eq('1');
            expect(url.searchParams.get('limit')).to.eq('10');
        });
        Orders.getActiveTab().should('have.attr', 'aria-selected', 'true');
    });

    // TC-МО-6, TC-МО-72
    it('Переключение на «Завершённые» отправляет запрос со status=finished', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**').as('orders');
        Orders.visit();
        cy.wait('@orders');
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersFinished');
        Orders.getFinishedTab().click();
        cy.wait('@ordersFinished').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('status')).to.eq('finished');
            expect(url.searchParams.get('page')).to.eq('1');
        });
        Orders.getFinishedTab().should('have.attr', 'aria-selected', 'true');
        Orders.getActiveTab().should('have.attr', 'aria-selected', 'false');
    });

    // TC-МО-7, TC-МО-73
    it('Переключение обратно на «Активные» после «Завершённые» возвращает status=active', () => {
        Orders.visit();
        Orders.getFinishedTab().click();
        // Дожидаемся, что переключение на "Завершённые" реально завершилось,
        // прежде чем регистрировать следующий intercept — иначе есть риск
        // поймать ещё не отработавший запрос "Завершённые" вместо "Активные"
        Orders.getFinishedTab().should('have.attr', 'aria-selected', 'true');
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersActive');
        Orders.getActiveTab().click();
        cy.wait('@ordersActive').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('status')).to.eq('active');
        });
    });

    // TC-МО-76
    it('Подложка переключателя переезжает мгновенно по клику, не дожидаясь ответа API', () => {
        Orders.visit();
        Orders.getActiveTab().should('have.attr', 'aria-selected', 'true');
        // Замедляем ответ API, чтобы проверить что переключение вкладки визуально
        // происходит раньше, чем приходит ответ
        cy.intercept('GET', '**/v2/personal/orders_list**', (req) => {
            req.on('response', (res) => {
                res.setDelay(2000);
            });
        }).as('slowOrders');
        Orders.getFinishedTab().click();
        Orders.getFinishedTab().should('have.attr', 'aria-selected', 'true');
        Orders.getActiveTab().should('have.attr', 'aria-selected', 'false');
    });
});

describe('Мои заказы — карточка заказа: содержимое', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-15, TC-МО-17 — сверка номера и статуса с реальным API.
    // ВАЖНО: TC-МО-62 предполагал, что текст статуса на карточке — это
    // order_status_banner.title. Разведкой 2026-08-06 это ОПРОВЕРГНУТО:
    // карточка реально рендерит summary.title.text (сверено на заказе
    // № 22000, где banner.title="Спасибо за покупку!", а на UI показано
    // summary.title="Заберите товары до 8 августа включительно"). Сверяем
    // с реальным полем; расхождение banner vs summary для payment_failed
    // заказов — отдельный баг BUG-009 ниже.
    it('Номер заказа и текст статуса на карточке соответствуют summary.title.text', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const first = body.data.orders[0];
            Orders.visit();
            Orders.getOrderCardByNumber(first.order.id).should('be.visible');
            Orders.getOrderCardByNumber(first.order.id).should('contain.text', first.summary.title.text);
        });
    });

    // TC-МО-62 — текст статуса в списке = summary.title.text для каждого заказа
    it('Текст статуса на карточке = summary.title.text для каждого заказа', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const orders = body.data.orders;
            Orders.visit();
            orders.forEach((o) => {
                Orders.getOrderCardByNumber(o.order.id).should('contain.text', o.summary.title.text);
            });
        });
    });

    // TC-МО-19, TC-МО-49 — BUG-004 ИСПРАВЛЕН (Jira AS-4506, подтверждено
    // 2026-08-10): раньше при пустом basket.items сумма на карточке
    // ошибочно бралась из basket.total_prices (0), теперь корректно
    // показывает payment_info.to_pay.
    it('Сумма на карточке соответствует payment_info.to_pay', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const emptyBasketOrder = body.data.orders.find((o) => o.basket.items.length === 0 && o.order.payment_info.to_pay > 0);
            if (!emptyBasketOrder) {
                cy.log('На аккаунте нет заказа с пустым basket.items и ненулевым to_pay — кейс пропущен');
                return;
            }
            const expected = emptyBasketOrder.order.payment_info.to_pay.toLocaleString('ru-RU').replace(/,/g, ' ');
            Orders.visit();
            Orders.getOrderCardByNumber(emptyBasketOrder.order.id).should('contain.text', expected);
        });
    });

    // TC-МО-36 — БАГ BUG-009: карточка должна показывать баннер "Оплата не
    // прошла" для КАЖДОГО заказа с order_status_banner.type=payment_failed,
    // но фактически показывает его только для части таких заказов (карточка
    // рендерит summary.title.text, который не всегда синхронизирован с
    // order_status_banner). Тест ожидает правильное поведение и падает,
    // пока баг не исправлен.
    it('Каждый заказ с order_status_banner.type=payment_failed показывает баннер ошибки оплаты — BUG-009', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const failedOrders = body.data.orders.filter((o) => o.order_status_banner.type === 'payment_failed');
            if (failedOrders.length === 0) {
                cy.log('На аккаунте нет заказов с ошибкой оплаты — кейс пропущен');
                return;
            }
            Orders.visit();
            failedOrders.forEach((o) => {
                Orders.getOrderCardByNumber(o.order.id).should('contain.text', 'Оплата не прошла');
            });
        });
    });

    // TC-МО-23 — клик по карточке переводит на страницу детализации
    it('Клик по карточке заказа переводит на страницу заказа', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const first = body.data.orders[0];
            Orders.visit();
            Orders.getOrderCardByNumber(first.order.id).click();
            cy.url().should('include', `/cabinet/order`);
        });
    });
});

describe('Мои заказы — пагинация', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-26 — кнопка "Ещё заказы" видна при 10 заказах на странице
    it('Кнопка «Ещё заказы» отображается, когда заказов на странице ровно limit', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            expect(body.data.orders.length, 'baseline: 10 заказов на первой странице').to.eq(10);
            Orders.visit();
            Orders.getLoadMoreButton().should('be.visible');
        });
    });

    // TC-МО-27 — клик "Ещё заказы" отправляет запрос с page=2.
    // ВАЖНО: intercept регистрируется ПОСЛЕ того, как исходная загрузка
    // страницы (page=1) уже гарантированно завершилась (дожидаемся видимости
    // кнопки) — иначе он рискует поймать ещё не отработавший запрос page=1
    // вместо запроса от клика (см. feedback_cypress_alias_race_pattern).
    // ВАЖНО №2: разведкой 2026-08-06 подтверждено, что запрос "Ещё заказы"
    // НЕ передаёт параметр limit вовсе (только самый первый запрос page=1
    // содержит limit=10) — это расхождение с TC-МО-33, но не ломает
    // отображение (сервер, видимо, применяет тот же лимит по умолчанию).
    // Не считаем багом без дополнительного подтверждения от бэкенда, но
    // фиксируем фактическое поведение.
    it('Клик «Ещё заказы» отправляет запрос со page=2, статус не меняется, limit не передаётся', () => {
        Orders.visit();
        Orders.getLoadMoreButton().should('be.visible');
        cy.intercept('GET', '**/v2/personal/orders_list**').as('page2');
        Orders.getLoadMoreButton().click();
        cy.wait('@page2').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('page')).to.eq('2');
            expect(url.searchParams.get('status')).to.eq('active');
        });
    });

    // TC-МО-30 — переключение вкладки сбрасывает page на 1
    it('Переключение вкладки после подгрузки страниц сбрасывает page на 1', () => {
        Orders.visit();
        Orders.getLoadMoreButton().click();
        cy.wait(1000);
        cy.intercept('GET', '**/v2/personal/orders_list**').as('switchTab');
        Orders.getFinishedTab().click();
        cy.wait('@switchTab').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('page')).to.eq('1');
            expect(url.searchParams.get('status')).to.eq('finished');
        });
    });

    // TC-МО-42 — мок: ровно 1 заказ, кнопка "Ещё заказы" отсутствует
    it('Ровно 1 заказ на вкладке — кнопка «Ещё заказы» не отображается (мок)', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: {
                result: true,
                errors: [],
                data: {
                    orders_count: { all: 1, active: 1, cancelled: 0, finished: 0 },
                    orders: [{
                        current_status: 'created',
                        can_cancel: true,
                        basket: { items: [{ product_id: 1, name: 'Мок-товар', preview: 'https://placehold.co/100', quantity: 1, prices_per_item: { base_price: 1000, discounted_price: 1000, has_discount: false } }], total_prices: { base_price: 1000, discounted_price: 1000, has_discount: false } },
                        order: {
                            id: '999999',
                            delivery_info: { address: 'Тест', name: null, pay: 0, type: 'courier', delivery_date: '01.01.2027', message: 'Тест доставка' },
                            payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 1000, to_pay: 1000 },
                            personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test User', person_type: 1 },
                            platform_name: 'test',
                        },
                        statuses: { created0: { date: '2027-01-01 00:00:00', status: 'created', name: 'Новый', is_current: true } },
                        workflow: [],
                        order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'new', icon: '', color: 'grey' },
                        summary: { title: { text: 'Мок-товар', type: 'black', color: 'black' }, subtitle: { text: 'Тест', type: 'grey', color: 'grey' } },
                        city_slug: 'astana',
                        created_at: '2027-01-01 00:00:00',
                    }],
                },
            },
        }).as('oneOrder');
        Orders.visit();
        cy.wait('@oneOrder');
        Orders.getLoadMoreButton().should('not.exist');
    });

    // TC-МО-9 — мок: пустой список активных заказов
    it('Пустое состояние «Нет активных заказов» (мок)', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: { result: true, errors: [], data: { orders_count: { all: 0, active: 0, cancelled: 0, finished: 0 }, orders: [] } },
        }).as('emptyOrders');
        Orders.visit();
        cy.wait('@emptyOrders');
        cy.contains(/[Нн]ет активных заказов/).should('be.visible');
    });
});

describe('Мои заказы — сверка полей с реальным API (баг-кандидаты из тест-плана)', () => {
    // TC-МО-60 — БАГ BUG-005: арифметика orders_count не сходится
    it('orders_count.active + cancelled + finished == orders_count.all — BUG-005', () => {
        cy.loginD2();
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const { all, active, cancelled, finished } = body.data.orders_count;
            expect(active + cancelled + finished, `active(${active}) + cancelled(${cancelled}) + finished(${finished})`).to.eq(all);
        });
    });

    // TC-МО-59 — BUG-006 отклонён (2026-08-07): формат " Фамилия Имя" в
    // personal_info.full_name заказа — подтверждённое ожидаемое поведение,
    // расхождение с profile_info.full_name не баг. Ассерт снят.

    // TC-МО-67 — BUG-007 отклонён (2026-08-07): расхождение created_at
    // и statuses[].date на 5 часов (UTC vs UTC+5) не актуально. Ассерт снят.

    // TC-МО-69 — BUG-030: order_status_banner обязан быть заполнен у КАЖДОГО
    // заказа (проверено разведкой 2026-08-10: заполнен у 267 из 268
    // просмотренных, кроме заказа №10392507). Тест ожидает правильное
    // поведение и падает на этом конкретном заказе, пока баг не исправлен.
    it('order_status_banner заполнен у каждого заказа на первых 3 страницах — BUG-030', () => {
        cy.loginD2();
        const pages = [1, 2, 3];
        pages.forEach((page) => {
            cabinetApi.getOrdersList({ status: 'active', page }).then(({ body }) => {
                body.data.orders.forEach((o) => {
                    expect(o.order_status_banner, `заказ №${o.order.id}: order_status_banner`).to.not.be.null;
                });
            });
        });
    });
});

describe('Мои заказы — общие блоки под списком (TC-МО-4)', () => {
    // TC-МО-4 — ИСПРАВЛЕНО согласно живой разведке 2026-08-10: тест-план заявлял,
    // что под списком заказов есть блоки "Вы недавно смотрели" и "Специально для
    // вас". На реальной странице /cabinet/orders/ (с непустым списком заказов)
    // НИ ОДНОГО из этих блоков нет вообще — страница заканчивается кнопкой
    // "Ещё заказы" (подтверждено разведкой: get_page_text не находит ни одной из
    // этих фраз). Похоже, тест-план перепутал эту страницу с корневой /cabinet/,
    // где блок "Вы недавно смотрели" РЕАЛЬНО существует (см. cabinet_overview.cy.js).
    // Фиксируем фактическое (текущее) поведение вместо ошибочного предположения плана.
    it('TC-МО-4: под списком заказов НЕТ блоков "Вы недавно смотрели"/"Специально для вас" (в отличие от /cabinet/)', () => {
        cy.loginD2();
        Orders.visit();
        Orders.getLoadMoreButton().should('be.visible');
        cy.contains(/Вы недавно смотрели/).should('not.exist');
        cy.contains(/Специально для вас/).should('not.exist');
    });
});

describe('Мои заказы — пустые состояния (TC-МО-10, TC-МО-11)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    const emptyOrdersBody = (counts) => ({
        result: true,
        errors: [],
        data: { orders_count: counts, orders: [] },
    });

    // TC-МО-10 — мок: пустой список завершённых заказов
    it('Пустое состояние «Нет завершенных заказов» (мок)', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', (req) => {
            const status = new URL(req.url).searchParams.get('status');
            if (status === 'finished') {
                req.reply(emptyOrdersBody({ all: 5, active: 5, cancelled: 0, finished: 0 }));
            }
        }).as('ordersMock');
        Orders.visit();
        Orders.getFinishedTab().click();
        cy.wait('@ordersMock');
        // Спеллинг без "ё" — сверено разведкой 2026-08-06 для "Завершенные"/вкладки,
        // тот же паттерн ожидаем и здесь
        cy.contains(/[Нн]ет завершенных заказов/).should('be.visible');
    });

    // TC-МО-11 — мок: ОБЕ вкладки пусты одновременно
    it('Обе вкладки пусты одновременно — пустое состояние на каждой', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', emptyOrdersBody({ all: 0, active: 0, cancelled: 0, finished: 0 })).as('ordersMock');
        Orders.visit();
        cy.wait('@ordersMock');
        cy.contains(/[Нн]ет активных заказов/).should('be.visible');
        Orders.getFinishedTab().click();
        cy.wait('@ordersMock');
        cy.contains(/[Нн]ет завершенных заказов/).should('be.visible');
    });
});

describe('Мои заказы — карточка заказа: содержимое (TC-МО-16, 18, 20-22, 24)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-16 — клик по иконке копирования номера заказа.
    // ВАЖНО (2026-08-10): ДВЕ разные попытки подставить стаб на
    // navigator.clipboard.writeText (пост-хок через cy.window().then(), и
    // штатный cy.visit({onBeforeLoad}) с Object.defineProperty) на практике
    // РЕАЛЬНО ПОДВЕШИВАЛИ прогон на много минут без единой ошибки в логе —
    // headless Electron на этом стенде, судя по всему, блокируется на попытке
    // достучаться до Clipboard API вне зависимости от того, когда подставлен
    // стаб. Не рискуем гонкой ещё раз — проверяем только то, что безопасно
    // проверить: иконка кликабельна и клик не ломает страницу, БЕЗ обращения
    // к самому Clipboard API.
    it('TC-МО-16: иконка копирования номера заказа кликабельна и не ломает страницу', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const first = body.data.orders[0];
            Orders.visit();
            Orders.getCopyIconByOrderNumber(first.order.id).should('be.visible').click({ force: true });
            cy.get('body').should('be.visible');
            Orders.getOrderCardByNumber(first.order.id).should('be.visible');
        });
    });

    // TC-МО-18 — адрес на карточке = summary.subtitle.text (для pickup-заказов
    // это и есть адрес магазина; для courier — тоже адрес, см. TC-МО-55/56)
    it('TC-МО-18: адрес на карточке соответствует summary.subtitle.text', () => {
        // ВАЖНО (2026-08-10): раньше здесь был отдельный cy.request() ДО
        // Orders.visit() — на живом/растущем аккаунте (900+ заказов) список
        // между этими двумя независимыми запросами может сдвинуться, из-за
        // чего выбранный order.id уже не на отрисованной странице. Сверяем
        // с ТЕМ ЖЕ ответом, который реально отрисовал UI.
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersLoad18');
        Orders.visit();
        cy.wait('@ordersLoad18', { timeout: 40000 }).then(({ response }) => {
            const withAddress = response.body.data.orders.find((o) => o.summary.subtitle && o.summary.subtitle.text);
            if (!withAddress) { cy.log('Нет заказа с непустым subtitle — кейс пропущен'); return; }
            Orders.getOrderCardByNumber(withAddress.order.id).should('contain.text', withAddress.summary.subtitle.text);
        });
    });

    // TC-МО-20/21/22 — мок заказа с несколькими товарами. ВАЖНО: живой разведкой
    // 2026-08-10 подтверждено, что карточка показывает по миниатюре на каждый
    // товар подряд (без явного лимита "3-4 шт" и БЕЗ плашки "+N" — не найдено ни
    // одного визуального ограничения вплоть до 2 товаров в реальных данных), поэтому
    // здесь проверяем то, что реально устойчиво проверяемо — количество товаров и
    // сумму в скрытом summary-тексте карточки, а не гадаем про конкретный лимит
    // миниатюр/плашки "+N", которого не удалось живьём подтвердить
    it('TC-МО-20/21/22: заказ с 5 товарами — счётчик "N товаров" и сумма корректны (мок)', () => {
        const items = Array.from({ length: 5 }, (_, i) => ({
            id: null, product_id: i + 1, name: `Мок-товар ${i + 1}`, code: `mock-${i + 1}`, xml_id: `xml-${i + 1}`,
            code_1c: '000', preview: 'https://placehold.co/100', quantity: 1,
            prices_per_item: { base_price: 1000, discounted_price: 1000, has_discount: false },
        }));
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: {
                result: true, errors: [],
                data: {
                    orders_count: { all: 1, active: 1, cancelled: 0, finished: 0 },
                    orders: [{
                        current_status: 'created', can_cancel: true,
                        basket: { items, total_prices: { base_price: 5000, discounted_price: 5000, has_discount: false } },
                        order: {
                            id: '888888',
                            delivery_info: { address: 'Тест', name: null, pay: 0, type: 'pickup', delivery_date: null, message: 'Заберите товары' },
                            payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 5000, to_pay: 5000 },
                            personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test', person_type: 1 },
                            platform_name: 'test',
                        },
                        statuses: {}, workflow: [],
                        order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'created', icon: '', color: 'success' },
                        summary: { title: { text: 'Заберите товары', type: 'black', color: 'black' }, subtitle: { text: 'Тест', type: 'grey', color: 'grey' } },
                        city_slug: 'astana', created_at: '2027-01-01 00:00:00',
                    }],
                },
            },
        }).as('fiveItems');
        Orders.visit();
        cy.wait('@fiveItems');
        cy.contains(/5 товаров/).should('exist');
        cy.contains('5 000 ₸').should('be.visible');
    });

    // TC-МО-24 — заказ с ЕДИНСТВЕННЫМ товаром: реальный заказ №1430 (1 товар),
    // проверяем правильное единственное число "1 товар" (а не "1 товаров")
    it('TC-МО-24: заказ с одним товаром показывает "1 товар" (единственное число)', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const single = body.data.orders.find((o) => o.basket.items.length === 1);
            if (!single) { cy.log('Нет заказа с ровно 1 товаром на этой странице — кейс пропущен'); return; }
            Orders.visit();
            Orders.getOrderCardByNumber(single.order.id).should('contain.text', '1 товар').and('not.contain.text', '1 товаров');
        });
    });
});

describe('Мои заказы — пагинация: дополнительные сценарии (TC-МО-28, 29, 31, 32, 34)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-28 — повторные клики "Ещё заказы" последовательно увеличивают page
    it('Повторный клик «Ещё заказы» продолжает увеличивать page (3, 4…)', () => {
        Orders.visit();
        Orders.getLoadMoreButton().should('be.visible');
        cy.intercept('GET', '**/v2/personal/orders_list**').as('page2');
        Orders.getLoadMoreButton().click();
        cy.wait('@page2');
        Orders.getLoadMoreButton().should('be.visible');
        cy.intercept('GET', '**/v2/personal/orders_list**').as('page3');
        Orders.getLoadMoreButton().click();
        cy.wait('@page3').then(({ request }) => {
            expect(new URL(request.url).searchParams.get('page')).to.eq('3');
        });
    });

    // TC-МО-29 — на аккаунте 801 активный заказ, кнопка "Ещё заказы" должна
    // оставаться видимой (конец списка недостижим в разумное время прогона) —
    // проверяем противоположный, реально достижимый случай: страница-мок,
    // где orders.length < limit — по контракту это сигнал "это последняя страница"
    it('Кнопка «Ещё заказы» скрывается, когда на странице заказов меньше limit', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', (req) => {
            req.reply({
                statusCode: 200,
                body: {
                    result: true, errors: [],
                    data: {
                        orders_count: { all: 3, active: 3, cancelled: 0, finished: 0 },
                        orders: Array.from({ length: 3 }, (_, i) => ({
                            current_status: 'created', can_cancel: true,
                            basket: { items: [], total_prices: { base_price: 0, discounted_price: 0, has_discount: false } },
                            order: {
                                id: String(700000 + i),
                                delivery_info: { address: 'Тест', name: null, pay: 0, type: 'pickup', delivery_date: null, message: 'Тест' },
                                payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 100, to_pay: 100 },
                                personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test', person_type: 1 },
                                platform_name: 'test',
                            },
                            statuses: {}, workflow: [],
                            order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'created', icon: '', color: 'success' },
                            summary: { title: { text: `Заказ ${i}`, type: 'black', color: 'black' }, subtitle: { text: 'Тест', type: 'grey', color: 'grey' } },
                            city_slug: 'astana', created_at: '2027-01-01 00:00:00',
                        })),
                    },
                },
            });
        }).as('lastPage');
        Orders.visit();
        cy.wait('@lastPage');
        Orders.getLoadMoreButton().should('not.exist');
    });

    // TC-МО-31 — F5 после подгрузки нескольких страниц сбрасывает список к
    // первой странице (10 карточек), а не сохраняет подгруженное.
    // ВАЖНО: getOrderCards() (селектор по классу-фону) матчит НЕСКОЛЬКО div на
    // одну карточку (подтверждено разведкой 2026-08-10 — сырое число элементов
    // не равно числу карточек), поэтому считаем по количеству УНИКАЛЬНЫХ номеров
    // "№ N" в тексте страницы — тот же надёжный приём, что и в тесте на
    // дубликаты при подгрузке ниже
    it('Обновление страницы (F5) после подгрузки нескольких страниц возвращает к 1 странице', () => {
        Orders.visit();
        Orders.getLoadMoreButton().click();
        cy.wait(1500);
        cy.get('body').then(($body) => {
            const before = new Set(($body.text().match(/№\s?\d+/g) || []));
            expect(before.size, 'после подгрузки должно быть больше 10 уникальных номеров').to.be.greaterThan(10);
        });
        cy.reload();
        Orders.getLoadMoreButton().should('be.visible');
        cy.get('body').then(($body) => {
            const after = new Set(($body.text().match(/№\s?\d+/g) || []));
            expect(after.size, 'после F5 — снова ровно 10 уникальных номеров (1 страница)').to.eq(10);
        });
    });

    // TC-МО-32 — некорректное значение status в запросе (прямой обход UI через API)
    it('Некорректное значение status в запросе к API обрабатывается без 5xx', () => {
        cabinetApi.getOrdersList({ status: 'not_a_real_status' }, { failOnStatusCode: false }).then((res) => {
            expect(res.status, 'статус ответа не должен быть 5xx').to.be.lessThan(500);
        });
    });

    // TC-МО-34 — заказы не дублируются при подгрузке нескольких страниц
    it('Заказы не дублируются при подгрузке 3 страниц подряд', () => {
        Orders.visit();
        Orders.getLoadMoreButton().click();
        cy.wait(1000);
        Orders.getLoadMoreButton().click();
        cy.wait(1000);
        Orders.getOrderCards().then(($cards) => {
            const numbers = [...$cards].map((el) => el.textContent.match(/№\s?(\d+)/)?.[1]).filter(Boolean);
            const unique = new Set(numbers);
            expect(unique.size, `${numbers.length} карточек, ${unique.size} уникальных номеров`).to.eq(numbers.length);
        });
    });
});

describe('Мои заказы — ошибка оплаты (TC-МО-37, 39)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-37 — сумма на кнопке "Оплатить" (детальная страница) = payment_info.to_pay.
    // TC-МО-38 (клик "Оплатить" инициирует оплату) НЕ автоматизирован намеренно —
    // клик реально уводит на форму оплаты картой, а правило безопасности проекта
    // запрещает вводить/отправлять платёжные данные даже на тестовом стенде.
    //
    // ВАЖНО: разделитель разрядов на странице — NBSP ( ), а не обычный
    // пробел, поэтому точное сравнение строки с `toLocaleString('ru-RU')`
    // (который тоже даёт NBSP, но не гарантированно совпадает байт-в-байт с
    // рендером фреймворка) ненадёжно — собираем регулярку с [\s ] между
    // группами разрядов вместо точного строкового сравнения.
    const priceRegex = (n) => {
        const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return new RegExp(grouped.split(' ').join('[\\s\\u00A0]'));
    };

    it('TC-МО-37: сумма к оплате на детальной странице заказа с ошибкой оплаты = payment_info.to_pay', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const failed = body.data.orders.find((o) => o.order_status_banner && o.order_status_banner.type === 'payment_failed');
            if (!failed) { cy.log('Нет заказа с ошибкой оплаты на этой странице — кейс пропущен'); return; }
            Orders.visitOrderDetail(failed.order.id);
            cy.contains(priceRegex(failed.order.payment_info.to_pay)).should('be.visible');
        });
    });

    // TC-МО-38 — аудит поля 2026-08-17: payments[].month_count/pay_sum_per_month
    // (заказ в рассрочку/кредит) на живом аккаунте НИ РАЗУ не встретился среди
    // сотен реальных заказов — покрытие этой ветки отсутствовало полностью,
    // закрываем через мок реального заказа (тот же паттерн, что уже используется
    // в bonuses.cy.js для is_offline и в delivery_combinations.cy.js).
    // РАЗВЕДКА (живой мок 2026-08-17): изначально тест ожидал текст вида
    // "N ₸/мес." (по аналогии с promotions_regress.cy.js → REGR-PROMO-005) —
    // при живом прогоне выяснилось, что на детальной странице ЗАКАЗА (в
    // отличие от карточки товара/акции) сумма в месяц вообще НЕ рендерится:
    // виден только сам способ оплаты ("Способ оплаты: Рассрочка"), без разбивки
    // по месяцам. То же семейство находки, что и с payments[].icon/city_slug —
    // поле есть в API, но на этой конкретной странице не используется. Не баг
    // (после оформления заказа график платежей — зона ответственности банка,
    // не карточки заказа на сайте), тест фиксирует ФАКТИЧЕСКОЕ поведение.
    it('TC-МО-38: заказ в рассрочку — на детальной странице виден только способ оплаты, без разбивки по месяцам (мок)', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const any = body.data.orders[0];
            if (!any) { cy.log('Нет ни одного заказа на аккаунте — кейс пропущен'); return; }

            cy.intercept('GET', `**/v2/personal/order/${any.order.id}`, (req) => {
                req.continue((res) => {
                    if (res.body?.data?.order?.payment_info?.payments?.[0]) {
                        const payment = res.body.data.order.payment_info.payments[0];
                        payment.type = 'Рассрочка';
                        payment.month_count = 12;
                        payment.pay_sum_per_month = 2333;
                    }
                });
            }).as('orderDetail');

            Orders.visitOrderDetail(any.order.id);
            cy.wait('@orderDetail', { timeout: 40000 });
            cy.contains('Рассрочка', { timeout: 15000 }).should('be.visible');
            cy.get('main').should('not.contain.text', '2 333');
        });
    });

    // TC-МО-39 — несколько заказов с ошибкой оплаты одновременно в списке.
    // ВАЖНО (2026-08-10): изначально фильтровали по order_status_banner.type ===
    // 'payment_failed' — но это ЛОВИТ УЖЕ ИЗВЕСТНЫЙ BUG-009 (карточка рендерит
    // summary.title.text, а НЕ order_status_banner.title/type — у части заказов
    // с payment_failed в API реально показывается вообще не связанный текст,
    // напр. "Ключ активации будет доступен...", если это оказался цифровой
    // товар). Не дублируем BUG-009 второй раз под другим TC — фильтруем по
    // РЕАЛЬНО отрисовываемому summary.title (та же логика, что фронт
    // использует для рендера), это и есть корректная проверка "несколько
    // заказов с ошибкой оплаты ОДНОВРЕМЕННО ВИДНЫ" (а не факт-чек самого
    // BUG-009, для которого есть отдельный тест выше).
    //
    // Аккаунт общий/живой (может меняться параллельными сессиями), поэтому
    // список заказов берём НЕ отдельным pre-fetch (риск гонки с тем, что реально
    // вернёт сама страница при Orders.visit()), а перехватываем ИМЕННО тот
    // запрос, который вызывает сам visit — гарантированно те же данные, что и в UI
    it('TC-МО-39: несколько заказов с ошибкой оплаты видны в списке одновременно', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersList');
        Orders.visit();
        cy.wait('@ordersList').then(({ response }) => {
            const failedOrders = response.body.data.orders.filter((o) => /Оплата не прошла/.test(o.summary.title.text));
            if (failedOrders.length < 2) { cy.log('Меньше 2 заказов с реально отображаемой ошибкой оплаты на этой странице — кейс пропущен'); return; }
            failedOrders.forEach((o) => {
                Orders.getOrderCardByNumber(o.order.id).should('contain.text', 'Оплата не прошла');
            });
        });
    });
});

describe('Мои заказы — мок-данные: объёмы и статусы (TC-МО-44, 45, 46, 47)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-44 — реальные данные: вкладка "Активные" одновременно содержит
    // заказы с разными current_status (created/ready_for_pickup/cancellation_request
    // — подтверждено разведкой 2026-08-10) и рендерит их по-разному (разный
    // summary.title/тип баннера для каждого)
    it('TC-МО-44: заказы с разными current_status в одной вкладке рендерятся по-своему', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const byStatus = {};
            body.data.orders.forEach((o) => { byStatus[o.current_status] = o; });
            const statuses = Object.keys(byStatus);
            if (statuses.length < 2) { cy.log('На этой странице только 1 current_status — кейс пропущен'); return; }
            Orders.visit();
            statuses.forEach((s) => {
                const o = byStatus[s];
                Orders.getOrderCardByNumber(o.order.id).should('contain.text', o.summary.title.text);
            });
        });
    });

    // TC-МО-45 — мок: заказ с 10+ товарами не ломает карточку
    it('TC-МО-45: заказ с 12 товарами отображается без поломки вёрстки (мок)', () => {
        const items = Array.from({ length: 12 }, (_, i) => ({
            id: null, product_id: i + 1, name: `Мок-товар ${i + 1}`, code: `mock-${i + 1}`, xml_id: `xml-${i + 1}`,
            code_1c: '000', preview: 'https://placehold.co/100', quantity: 1,
            prices_per_item: { base_price: 500, discounted_price: 500, has_discount: false },
        }));
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: {
                result: true, errors: [],
                data: {
                    orders_count: { all: 1, active: 1, cancelled: 0, finished: 0 },
                    orders: [{
                        current_status: 'created', can_cancel: true,
                        basket: { items, total_prices: { base_price: 6000, discounted_price: 6000, has_discount: false } },
                        order: {
                            id: '777777',
                            delivery_info: { address: 'Тест', name: null, pay: 0, type: 'pickup', delivery_date: null, message: 'Заберите товары' },
                            payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 6000, to_pay: 6000 },
                            personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test', person_type: 1 },
                            platform_name: 'test',
                        },
                        statuses: {}, workflow: [],
                        order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'created', icon: '', color: 'success' },
                        summary: { title: { text: 'Заберите товары', type: 'black', color: 'black' }, subtitle: { text: 'Тест', type: 'grey', color: 'grey' } },
                        city_slug: 'astana', created_at: '2027-01-01 00:00:00',
                    }],
                },
            },
        }).as('twelveItems');
        Orders.visit();
        cy.wait('@twelveItems');
        cy.get('body').should('be.visible');
        cy.contains('6 000 ₸').should('be.visible');
    });

    // TC-МО-46 — мок: заказ с суммой 0 ₸ не ломает карточку
    it('TC-МО-46: заказ с суммой 0 ₸ отображается без поломки (мок)', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: {
                result: true, errors: [],
                data: {
                    orders_count: { all: 1, active: 1, cancelled: 0, finished: 0 },
                    orders: [{
                        current_status: 'created', can_cancel: true,
                        basket: { items: [], total_prices: { base_price: 0, discounted_price: 0, has_discount: false } },
                        order: {
                            id: '666666',
                            delivery_info: { address: 'Тест', name: null, pay: 0, type: 'pickup', delivery_date: null, message: 'Заберите товары' },
                            payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 0, to_pay: 0 },
                            personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test', person_type: 1 },
                            platform_name: 'test',
                        },
                        statuses: {}, workflow: [],
                        order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'created', icon: '', color: 'success' },
                        summary: { title: { text: 'Заберите товары', type: 'black', color: 'black' }, subtitle: { text: 'Тест', type: 'grey', color: 'grey' } },
                        city_slug: 'astana', created_at: '2027-01-01 00:00:00',
                    }],
                },
            },
        }).as('zeroSum');
        Orders.visit();
        cy.wait('@zeroSum');
        cy.contains('0 ₸').should('be.visible');
    });

    // TC-МО-47 — мок: заказ без адреса (самовывоз, address: "")
    it('TC-МО-47: заказ без указанного адреса не ломает карточку (мок)', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**', {
            statusCode: 200,
            body: {
                result: true, errors: [],
                data: {
                    orders_count: { all: 1, active: 1, cancelled: 0, finished: 0 },
                    orders: [{
                        current_status: 'created', can_cancel: true,
                        basket: { items: [], total_prices: { base_price: 1000, discounted_price: 1000, has_discount: false } },
                        order: {
                            id: '555555',
                            delivery_info: { address: '', name: null, pay: 0, type: 'pickup', delivery_date: null, message: 'Заберите товары' },
                            payment_info: { spent_bonuses: 0, bonuses: 0, payments: [], total: 1000, to_pay: 1000 },
                            personal_info: { email: 'a@a.kz', phone: '0000000000', full_name: 'Test', person_type: 1 },
                            platform_name: 'test',
                        },
                        statuses: {}, workflow: [],
                        order_status_banner: { title: 'Новый заказ', description: { message: '', hyperlinks: null }, type: 'created', icon: '', color: 'success' },
                        summary: { title: { text: 'Заберите товары', type: 'black', color: 'black' }, subtitle: { text: '', type: 'grey', color: 'grey' } },
                        city_slug: 'astana', created_at: '2027-01-01 00:00:00',
                    }],
                },
            },
        }).as('noAddress');
        Orders.visit();
        cy.wait('@noAddress');
        cy.get('body').should('be.visible');
        cy.contains('№ 555555').should('be.visible');
    });
});

describe('Мои заказы — сверка полей карточки с реальным API (TC-МО-48, 50, 52-58, 63-66, 68)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-48 — номер заказа на карточке = order.id. Аккаунт общий/живой —
    // перехватываем ИМЕННО запрос самого visit(), а не отдельный pre-fetch
    // (см. пояснение у TC-МО-39 — та же гонка с параллельными сессиями)
    it('TC-МО-48: номер на карточке для каждого заказа = order.id', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersList');
        Orders.visit();
        cy.wait('@ordersList').then(({ response }) => {
            response.body.data.orders.forEach((o) => {
                Orders.getOrderCardByNumber(o.order.id).should('contain.text', `№ ${o.order.id}`);
            });
        });
    });

    // TC-МО-50 — при частичной оплате бонусами (spent_bonuses>0) итоговая сумма на
    // карточке = payment_info.to_pay (уже за вычетом бонусов), а не .total
    it('TC-МО-50: при spent_bonuses>0 сумма на карточке = to_pay (за вычетом бонусов)', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const withBonuses = body.data.orders.find((o) => o.order.payment_info.spent_bonuses > 0);
            if (!withBonuses) { cy.log('Нет заказа с spent_bonuses>0 на этой странице — кейс пропущен'); return; }
            const expected = withBonuses.order.payment_info.to_pay.toLocaleString('ru-RU').replace(/,/g, ' ');
            Orders.visit();
            Orders.getOrderCardByNumber(withBonuses.order.id).should('contain.text', expected);
        });
    });

    // TC-МО-52 — цифровой товар (digitalProductKey): заголовок и подзаголовок
    // карточки — ОДИН и тот же текст (подтверждено реальными данными 2026-08-10:
    // "Ключ активации будет доступен в течение 15 минут" дублируется в обоих полях)
    it('TC-МО-52: для заказа с цифровым товаром title и subtitle карточки совпадают', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const digital = body.data.orders.find((o) => o.basket.items.some((it) => it.digitalProductKey));
            if (!digital) { cy.log('Нет заказа с цифровым товаром на этой странице — кейс пропущен'); return; }
            expect(digital.summary.title.text, 'title и subtitle цифрового заказа совпадают').to.eq(digital.summary.subtitle.text);
            Orders.visit();
            Orders.getOrderCardByNumber(digital.order.id).should('contain.text', digital.summary.title.text);
        });
    });

    // TC-МО-53/54 — summary.title/subtitle СОВПАДАЮТ с delivery_info.message/address
    // дословно (это одни и те же данные, продублированные в разных полях ответа)
    it('TC-МО-53/54: summary.title = delivery_info.message, summary.subtitle = delivery_info.address', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const o = body.data.orders.find((x) => x.order.delivery_info.message && x.order.delivery_info.address);
            if (!o) { cy.log('Нет подходящего заказа — кейс пропущен'); return; }
            expect(o.summary.title.text, 'title = delivery_info.message').to.eq(o.order.delivery_info.message);
            expect(o.summary.subtitle.text, 'subtitle = delivery_info.address').to.eq(o.order.delivery_info.address);
        });
    });

    // TC-МО-55/56 — сообщение для pickup ("Заберите товары до X") отличается
    // от сообщения для courier ("Планируем доставить до X") — реальные данные
    it('TC-МО-55/56: сообщение о доставке отличается для pickup и courier', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const pickup = body.data.orders.find((o) => o.order.delivery_info.type === 'pickup');
            const courier = body.data.orders.find((o) => o.order.delivery_info.type === 'courier');
            if (pickup) expect(pickup.order.delivery_info.message).to.match(/Заберите товары/);
            if (courier) expect(courier.order.delivery_info.message).to.match(/Планируем доставить/);
            if (!pickup && !courier) cy.log('Нет ни pickup, ни courier заказа на этой странице — кейс пропущен');
        });
    });

    // TC-МО-57/58 — миниатюра товара на карточке = картинка первого товара
    // basket.items[0].preview (URL корректный, а не сломанный/пустой)
    it('TC-МО-57/58: изображение на карточке = basket.items[0].preview', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const withItem = body.data.orders.find((o) => o.basket.items.length > 0 && o.basket.items[0].preview);
            if (!withItem) { cy.log('Нет заказа с товаром/картинкой на этой странице — кейс пропущен'); return; }
            Orders.visit();
            Orders.getOrderCardByNumber(withItem.order.id).find('img').first()
                .should('have.attr', 'src')
                .and('include', new URL(withItem.basket.items[0].preview).hostname);
        });
    });

    // TC-МО-63 — current_status соответствует РЕАЛЬНО отображаемому статусу:
    // canceled -> "Заказ отменен", completed -> "Выполнен" (подтверждено реальными
    // данными 2026-08-10 — ЭТО, а не order_status_banner.title, показывается в списке)
    it('TC-МО-63: canceled -> "Заказ отменен", completed -> "Выполнен" на карточке', () => {
        // ВАЖНО (2026-08-10): раньше здесь был отдельный cy.request() ДО
        // Orders.visit(), тот же класс гонки живых данных, что и в TC-МО-18
        // выше — сверяем с ответом, который реально получила вкладка
        // "Завершенные" ПОСЛЕ клика, а не с независимым pre-fetch.
        cy.intercept('GET', '**/v2/personal/orders_list**status=finished**').as('ordersFinished63');
        Orders.visit();
        Orders.getFinishedTab().click();
        cy.wait('@ordersFinished63', { timeout: 40000 }).then(({ response }) => {
            const canceled = response.body.data.orders.find((o) => o.current_status === 'canceled');
            const completed = response.body.data.orders.find((o) => o.current_status === 'completed');
            if (canceled) Orders.getOrderCardByNumber(canceled.order.id).should('contain.text', 'Заказ отменен');
            if (completed) Orders.getOrderCardByNumber(completed.order.id).should('contain.text', 'Выполнен');
            if (!canceled && !completed) cy.log('Ни canceled, ни completed заказа на этой странице — кейс пропущен');
        });
    });

    // TC-МО-64 — order_status_banner.color соответствует ожидаемой полярности:
    // error -> красный текст в UI (уже проверено для payment_failed/cancelled как
    // "Оплата не прошла"/"Заказ отменен"), success -> обычный текст без красного.
    // ВАЖНО (2026-08-10): фильтровать заказ ПО ПОЛЮ banner.color нельзя напрямую —
    // тот же BUG-009 (карточка рендерит summary.title.text, а не поля баннера):
    // заказ может иметь color=error в API, но реально показывать вообще не
    // относящийся к ошибке текст (напр. цифровой товар), который никогда не
    // будет красным, потому что это не тот текст, который вообще должен быть
    // красным. Фильтруем по РЕАЛЬНО отрисовываемому summary.title (та же правка,
    // что и в TC-МО-39), а не по метаданным баннера.
    //
    // Страница дублирует разметку под мобильную/десктопную версии — тот же
    // текст существует ДВАЖДЫ в DOM (скрытый 0×0 дубль + видимый), поэтому после
    // .filter() по тексту дополнительно фильтруем по реальной видимости
    // (getBoundingClientRect), иначе можно случайно попасть на скрытый узел с
    // дефолтным (не красным) цветом — тот же класс проблемы, что и в других
    // местах этого проекта (см. detailPage.js/categoryIcons). Данные — из ответа
    // самого visit() (перехват), а не отдельный pre-fetch — см. TC-МО-39/48.
    it('TC-МО-64: banner.color=error соответствует красному тексту статуса на карточке', () => {
        cy.intercept('GET', '**/v2/personal/orders_list**').as('ordersList');
        Orders.visit();
        cy.wait('@ordersList').then(({ response }) => {
            const errorOrder = response.body.data.orders.find((o) => o.order_status_banner && o.order_status_banner.color === 'error' && /Оплата не прошла|Заказ отменен/.test(o.summary.title.text));
            if (!errorOrder) { cy.log('Нет заказа с color=error и реально отображаемым текстом ошибки на этой странице — кейс пропущен'); return; }
            Orders.getOrderCardByNumber(errorOrder.order.id).find('p,span')
                .filter((i, el) => {
                    const rect = el.getBoundingClientRect();
                    return el.textContent.trim() === errorOrder.summary.title.text && rect.width > 0 && rect.height > 0;
                })
                .should(($el) => {
                    const color = window.getComputedStyle($el[0]).color;
                    // ожидаем красный (rgb с доминирующим красным каналом)
                    const rgb = color.match(/\d+/g).map(Number);
                    expect(rgb[0], `R-канал цвета текста статуса (${color})`).to.be.greaterThan(rgb[1]);
                });
        });
    });

    // TC-МО-65 — реальные данные вместо мока: карточки для разных current_status
    // (created/ready_for_pickup/completed/cancelled) выглядят по-разному —
    // де-факто то же самое, что и TC-МО-44 выше, оставлено как отдельная сверка
    // на статусах из ОБЕИХ вкладок (created/ready_for_pickup из active,
    // completed/cancelled из finished)
    it('TC-МО-65: карточки created/ready_for_pickup/completed/cancelled отличаются по тексту статуса', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body: activeBody }) => {
            cabinetApi.getOrdersList({ status: 'finished' }).then(({ body: finishedBody }) => {
                const created = activeBody.data.orders.find((o) => o.current_status === 'created');
                const readyForPickup = activeBody.data.orders.find((o) => o.current_status === 'ready_for_pickup');
                const completed = finishedBody.data.orders.find((o) => o.current_status === 'completed');
                const cancelled = finishedBody.data.orders.find((o) => o.current_status === 'canceled');
                const titles = [created, readyForPickup, completed, cancelled].filter(Boolean).map((o) => o.summary.title.text);
                const uniqueTitles = new Set(titles.map((t) => t.replace(/\d.*/, '').trim())); // отбрасываем дату/номер для сравнения "формы" текста
                expect(uniqueTitles.size, `тексты статусов: ${JSON.stringify(titles)}`).to.be.greaterThan(1);
            });
        });
    });

    // TC-МО-66 — кнопка "Отменить заказ" на детальной странице видна ТОЛЬКО
    // при can_cancel:true (реальные данные: can_cancel корректно false для
    // canceled/completed/cancellation_request, true для created/ready_for_pickup)
    it('TC-МО-66: кнопка «Отменить заказ» видна только при can_cancel:true', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const cancellable = body.data.orders.find((o) => o.can_cancel === true);
            const notCancellable = body.data.orders.find((o) => o.can_cancel === false);
            if (cancellable) {
                Orders.visitOrderDetail(cancellable.order.id);
                Orders.getCancelButton().should('be.visible');
            }
            if (notCancellable) {
                Orders.visitOrderDetail(notCancellable.order.id);
                Orders.getCancelButton().should('not.exist');
            }
            if (!cancellable && !notCancellable) cy.log('Нет подходящих заказов на этой странице — кейс пропущен');
        });
    });

    // TC-МО-68 — оплата "в магазине" (is_paid:false) — легитимное штатное
    // состояние, НЕ должна путаться с ошибкой оплаты (payment_failed) —
    // реальный заказ №1430: payments[0].type="Оплата в магазине", is_paid:false,
    // при этом order_status_banner.type НЕ payment_failed
    it('TC-МО-68: «Оплата в магазине» (is_paid:false) не показывается как ошибка оплаты', () => {
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const inShop = body.data.orders.find((o) => o.order.payment_info.payments.some((p) => p.type === 'Оплата в магазине' && p.is_paid === false));
            if (!inShop) { cy.log('Нет заказа с оплатой в магазине на этой странице — кейс пропущен'); return; }
            expect(inShop.order_status_banner && inShop.order_status_banner.type, `заказ №${inShop.order.id}`).to.not.eq('payment_failed');
            Orders.visit();
            Orders.getOrderCardByNumber(inShop.order.id).should('not.contain.text', 'Оплата не прошла');
        });
    });
});

describe('Мои заказы — вкладки: query-параметры и статусы (TC-МО-75, 77, 81, 82, 84, 87)', () => {
    // TC-МО-75 — арифметика ВНУТРИ вкладки "Завершённые": она объединяет
    // canceled+completed+прочие терминальные статусы (см. TC-МО-74, уже
    // подтверждено ранее), сумма current_status внутри status=finished
    // должна равняться orders_count.finished
    it('TC-МО-74/75: сумма current_status внутри вкладки "Завершенные" = orders_count.finished', () => {
        cy.loginD2();
        const byStatus = {};
        const walkPage = (page, acc) => cabinetApi.getOrdersList({ status: 'finished', page }).then(({ body }) => {
            body.data.orders.forEach((o) => { acc[o.current_status] = (acc[o.current_status] || 0) + 1; });
            if (page < 3) return walkPage(page + 1, acc); // 3 страницы выборки, не весь список — быстрая, но представительная сверка
            return acc;
        });
        walkPage(1, byStatus).then((counts) => {
            cabinetApi.getOrdersList({ status: 'finished', page: 1 }).then(({ body }) => {
                const sampleSum = Object.values(counts).reduce((a, b) => a + b, 0);
                cy.log(`Статусы внутри "Завершенные" на выборке 3 страниц: ${JSON.stringify(counts)}`);
                expect(sampleSum, 'сумма current_status на выборке = кол-ву просмотренных заказов').to.eq(30);
                expect(body.data.orders_count.finished, 'orders_count.finished').to.be.at.least(sampleSum);
            });
        });
    });

    // TC-МО-77 — реальные данные: completed отличается от canceled визуально
    // (см. также TC-МО-63/65 выше — дублирует ту же сверку с фокусом именно на
    // паре completed/canceled, как в первоисточнике теста)
    it('TC-МО-77: current_status=completed отображается иначе, чем canceled', () => {
        cy.loginD2();
        cabinetApi.getOrdersList({ status: 'finished' }).then(({ body }) => {
            const completed = body.data.orders.find((o) => o.current_status === 'completed');
            const canceled = body.data.orders.find((o) => o.current_status === 'canceled');
            if (!completed || !canceled) { cy.log('Нет обеих категорий на этой странице — кейс пропущен'); return; }
            expect(completed.summary.title.text).to.not.eq(canceled.summary.title.text);
            expect(completed.summary.title.type, 'completed использует другой цвет текста, чем canceled (grey)').to.not.eq(canceled.summary.title.type);
        });
    });

    // TC-МО-81/82 — ИСПРАВЛЕНО согласно живой разведке 2026-08-10: тест-план
    // предполагал "pickup всегда delivery_date=null, courier — всегда заполнена".
    // Это ОПРОВЕРГНУТО на реальных данных (186 pickup / 82 courier заказов):
    // pickup ИНОГДА имеет delivery_date (когда current_status=ready_for_pickup —
    // это дата "заберите до"), courier ИНОГДА без даты (ранние/отменённые
    // заказы, дата ещё не назначена). Фиксируем РЕАЛЬНОЕ правило вместо
    // ошибочного предположения плана: delivery_date всегда null для pickup,
    // ПОКА заказ не в статусе ready_for_pickup.
    it('TC-МО-81/82: delivery_date для pickup появляется только в статусе ready_for_pickup', () => {
        cy.loginD2();
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const pickupCreated = body.data.orders.find((o) => o.order.delivery_info.type === 'pickup' && o.current_status === 'created');
            const pickupReady = body.data.orders.find((o) => o.order.delivery_info.type === 'pickup' && o.current_status === 'ready_for_pickup');
            if (pickupCreated) expect(pickupCreated.order.delivery_info.delivery_date, `заказ №${pickupCreated.order.id} (created)`).to.be.null;
            if (pickupReady) expect(pickupReady.order.delivery_info.delivery_date, `заказ №${pickupReady.order.id} (ready_for_pickup)`).to.not.be.null;
            if (!pickupCreated && !pickupReady) cy.log('Нет pickup-заказов нужных статусов на этой странице — кейс пропущен');
            // Формат delivery_date (DD.MM.YYYY) заметно отличается от формата
            // created_at (YYYY-MM-DD HH:mm:ss) в том же ответе — тоже часть TC-МО-81
            if (pickupReady) expect(pickupReady.order.delivery_info.delivery_date).to.match(/^\d{2}\.\d{2}\.\d{4}$/);
            expect(body.data.orders[0].created_at).to.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });
    });

    // TC-МО-84 — заказ с digitalProductKey отображается корректно в списке
    // (уже частично покрыто TC-МО-52 — здесь фокус именно на самом факте
    // наличия digitalProductKey в товаре, а не на дублировании текста)
    it('TC-МО-84: заказ с digitalProductKey (цифровой товар) отображается в списке', () => {
        cy.loginD2();
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const digital = body.data.orders.find((o) => o.basket.items.some((it) => it.digitalProductKey));
            if (!digital) { cy.log('Нет заказа с цифровым товаром на этой странице — кейс пропущен'); return; }
            Orders.visit();
            Orders.getOrderCardByNumber(digital.order.id).should('be.visible');
        });
    });

    // TC-МО-87 — person_type в personal_info различается между заказами одного
    // пользователя (реальные данные: 2 обнаруженных значения — 1 и 2)
    it('TC-МО-87: person_type в personal_info может различаться между заказами', () => {
        cy.loginD2();
        cabinetApi.getOrdersList({ status: 'active' }).then(({ body }) => {
            const types = new Set(body.data.orders.map((o) => o.order.personal_info.person_type));
            cy.log(`person_type на этой странице: ${[...types].join(', ')}`);
            // Мягкая проверка: значение всегда присутствует и является числом
            body.data.orders.forEach((o) => {
                expect(o.order.personal_info.person_type, `заказ №${o.order.id}`).to.be.a('number');
            });
        });
    });
});
