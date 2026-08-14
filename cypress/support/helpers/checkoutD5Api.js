// Прямые запросы к backend API тестового стенда d5.im.mdev.kz в обход UI.
//
// ВАЖНО: этот стенд — ОТДЕЛЬНЫЙ бэкенд (http://api.d5.im.mdev.kz), не
// www.mechta.kz и не api.d.im.mdev.kz (d2). Здесь подключён новый эквайринг
// (test-epay.epayment.kz), проверено живой разведкой 2026-08-12 — см.
// project_checkout_acquirer_migration_test в памяти. Паттерн файла — по
// аналогии с cabinetApi.js (стенд d2).
const API_BASE = 'http://api.d5.im.mdev.kz';
const DEVICE_ID = 'cypress-test-device-id';

// Корзина. Источник истины для проверки состава/скидок/промокода/бонусов
// на каждом шаге чекаута. coupon_list[].applied — активен ли купон,
// discount_by_coupons — сумма его скидки. См. BUG-001 (AS-4565): купон
// «прилипает» к аккаунту и автоприменяется к новым, не связанным корзинам.
export function getBasket({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/basket`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Данные чекаута (получатель/способ доставки/способ оплаты/итого) —
// тот же эндпоинт, который UI дергает на каждом шаге оформления
// (см. checkout.js: cy.intercept('GET', '**/api/v2/checkout*')).
export function getCheckout(qs = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/checkout`,
        qs,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Детали оформленного заказа — сверка итоговой суммы/состава/статуса
// оплаты после подтверждения заказа.
export function getOrder(orderId, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/order/${orderId}`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Баланс бонусов/фишек — используется для проверки, что чекаут
// отображает и списывает реальный баланс (см. известный рассинхрон
// GET /v2/personal → bonus_info.active vs реальный баланс в UI,
// задокументирован как «не баг» в BugReport/Оформление заказа/README.md).
export function getPersonal({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export { API_BASE, DEVICE_ID };
