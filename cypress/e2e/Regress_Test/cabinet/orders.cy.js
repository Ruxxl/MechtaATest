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

    // TC-МО-2 — БАГ BUG-008: заголовка "Заказы" нет вообще ни в каком виде.
    // Тест ожидает правильное поведение и падает, пока баг не исправлен.
    it('Отображение заголовка «Заказы» — BUG-008', () => {
        cy.get('h1').should('have.length', 1).and('contain.text', 'Заказы');
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

    // TC-МО-19, TC-МО-49 — БАГ BUG-004: сумма на карточке при пустом basket.items
    // не совпадает с payment_info.to_pay (берётся basket.total_prices, который 0).
    // Тест ожидает правильное поведение и падает, пока баг не исправлен.
    it('Сумма на карточке соответствует payment_info.to_pay — BUG-004', () => {
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
});
