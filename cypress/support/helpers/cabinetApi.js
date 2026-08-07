// Прямые запросы к backend API тестового стенда d2.im.mdev.kz в обход UI.
//
// ВАЖНО: этот стенд — ОТДЕЛЬНЫЙ бэкенд, не www.mechta.kz. Фронтенд
// d2.im.mdev.kz ходит на http://api.d.im.mdev.kz (обычный http, не https).
// Подтверждено разведкой 2026-08-06 через реальные network-запросы браузера.
const API_BASE = 'http://api.d.im.mdev.kz';

// Некоторые эндпоинты (по аналогии с /v3/catalog/products на проде) требуют
// X-Mechta-Device-Id, иначе отдают 400 device_id_not_provided. В браузере это
// подставляет сама фронтенд-обвязка (localStorage user_device_id), но
// cy.request() идёт напрямую из Node-процесса Cypress и этого заголовка не
// имеет — подставляем руками. Значение — любая непустая строка.
const DEVICE_ID = 'cypress-test-device-id';

export function getPersonal({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getUser({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/user`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getHistory({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v3/personal/history`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getWaitingProducts({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/reviews/waiting-products`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getBonusesHistory({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/bonuses-history`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getOrdersList({ status = 'active', page = 1, limit = 10 } = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/orders_list`,
        qs: { status, page, limit },
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getBonusesHistoryPage({ page = 1, limit = 10 } = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/bonuses-history`,
        qs: { page, limit },
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getCoupons({ filterBy = 'active' } = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v3/personal/promo-codes`,
        qs: { filterBy },
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getReviewsPersonal({ filter = 'all', page = 0 } = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/reviews/personal`,
        qs: { filter, page },
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Избранное — {products: [...], count}, БЕЗ обёртки {result,errors,data}
// (сверено разведкой 2026-08-07, см. BUG-029).
export function getFavorites({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v3/favorites`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function getCards({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v2/personal/card`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

// Профиль (модалка "Редактировать данные"). Разведка 2026-08-07 —
// см. project_lk_testing_d2_stand memory. GET возвращает {fields:[{name,
// label, placeholder, type, value, validation[], data{}}]}; PUT принимает
// {firstname, lastname, birthdate, gender, email} (contact_phone НЕ
// отправляется — поле disabled). Успешный PUT — 204 без тела, обновлённые
// данные фронт получает отдельным повторным GET (сам PUT их не возвращает).
export function getProfile({ headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/v3/profile`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        failOnStatusCode,
    });
}

export function putProfile(body, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'PUT',
        url: `${API_BASE}/v3/profile`,
        headers: { Accept: 'application/json', 'X-Mechta-Device-Id': DEVICE_ID, ...headers },
        body,
        failOnStatusCode,
    });
}

// Достаёт {name: value} из ответа GET /v3/profile — удобно для сравнений в тестах.
export function profileFieldsMap(body) {
    const map = {};
    body.fields.forEach((f) => { map[f.name] = f.value; });
    return map;
}

export { API_BASE, DEVICE_ID };
