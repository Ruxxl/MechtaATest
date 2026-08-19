// Прямые запросы к backend API тестового стенда pp.im.mdev.kz в обход UI.
//
// ВАЖНО: этот стенд — ОТДЕЛЬНЫЙ бэкенд (http://api.pp.im.mdev.kz), не
// www.mechta.kz и не api.d.im.mdev.kz (d2) / api.d5.im.mdev.kz (d5). Здесь
// эквайринг epay.homebank.kz ("Halyk Payment Page") живьём подтверждён
// РАБОЧИМ 2026-08-18 (в отличие от сломанного test-epay.epayment.kz на d5) —
// см. memory reference_pp_im_stand. Паттерн файла — по аналогии с
// checkoutD5Api.js/cabinetApi.js. Аккаунт (0000000000/0000) общий с
// d2/d5/pp.yc — состояние корзины/заказов переносится между стендами.
const API_BASE = 'http://api.pp.im.mdev.kz';
const DEVICE_ID = 'cypress-test-device-id';

// Корзина. Источник истины для проверки состава/скидок/промокода/бонусов
// на каждом шаге чекаута.
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
// (см. checkoutPpIm.js).
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

// Баланс бонусов/фишек — используется для проверки, что чекаут отображает
// и списывает реальный баланс.
export function getPersonal({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Карточка товара — используется, чтобы динамически найти товар с активным
// подарком (gifts), не хардкодя маркетинговое состояние каталога.
// ВАЖНО (найдено 2026-08-18): для НЕКОТОРЫХ товаров этот эндпоинт отдаёт
// настоящую серверную ошибку вместо данных — {"result":false,"errors":
// ["App\\Domain\\Shop\\Entities\\ShopEntity::__construct(): Argument #2
// ($phones) not passed"]} — а не аккуратный 404/"Product not found" (тот
// для реально несуществующего slug приходит нормально). См. memory
// reference_pp_im_stand — всегда проверяй конкретный slug перед
// хардкодом, эта ошибка не связана с темой оплаты картой, но может быть
// самостоятельным багом.
export function getProduct(slug, { headers = {}, failOnStatusCode = false } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/product/${slug}`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Список заказов личного кабинета (Мои заказы, /cabinet/orders/) — используется
// для сверки суммы, показанной в шапке карточки заказа в списке, с реальной
// суммой к оплате (см. BUG-002: у неоплаченных заказов с курьерской доставкой
// шапка карточки показывает basket.total_prices вместо payment_info.total,
// то есть без учёта стоимости доставки).
export function getOrdersList({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/orders_list`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export { API_BASE, DEVICE_ID };
