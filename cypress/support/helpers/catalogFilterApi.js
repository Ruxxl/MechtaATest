// Прямые запросы к реальному backend API каталога/фильтров детальной страницы
// акции (/useful/shares/{slug}/) — в обход UI.
//
// Обнаружено разведкой 2026-08-04: вопреки предположению исходного тест-плана
// ("применение фильтра — не XHR, а полная навигация"), фронтенд реально дёргает
// 4 отдельных запроса при заходе на страницу категории/подкатегории с фильтрами:
// /catalog/category, /catalog/products, /catalog/filter, /catalog/offers.
// /catalog/products ОБЯЗАТЕЛЬНО требует заголовок X-Mechta-Device-Id (иначе 422
// device_id_not_provided) — значение может быть любой непустой строкой.
const API_BASE = 'https://www.mechta.kz/api/v3';
const DEFAULT_HEADERS = { Accept: 'application/json', 'X-City-Code': 'astana' };

function buildPropertiesQuery(properties = {}) {
    const parts = [];
    Object.entries(properties).forEach(([group, values]) => {
        (Array.isArray(values) ? values : [values]).forEach((value) => {
            parts.push(`properties[${group}][]=${encodeURIComponent(value)}`);
        });
    });
    return parts.join('&');
}

export function getCatalogCategory(slug, promotion, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/catalog/category?slug=${encodeURIComponent(slug)}&promotion=${encodeURIComponent(promotion)}`,
        headers: { ...DEFAULT_HEADERS, ...headers },
        failOnStatusCode,
    });
}

// properties — объект вида { brend: ['tefal', 'dreame'], discount: ['has_discount'] }
export function getCatalogFilters(slug, promotion, properties = {}, { headers = {}, failOnStatusCode = true } = {}) {
    const propsQuery = buildPropertiesQuery(properties);
    const url = `${API_BASE}/catalog/filter?slug=${encodeURIComponent(slug)}&promotion=${encodeURIComponent(promotion)}${propsQuery ? `&${propsQuery}` : ''}`;
    return cy.request({ method: 'GET', url, headers: { ...DEFAULT_HEADERS, ...headers }, failOnStatusCode });
}

export function getCatalogProducts(slug, promotion, {
    properties = {}, page = 1, pageSize = 24, orderBy = 'sort', direction = 'desc', minPrice, maxPrice, headers = {}, failOnStatusCode = true,
} = {}) {
    const propsQuery = buildPropertiesQuery(properties);
    // minPrice/maxPrice — отдельные query-параметры (не properties[...]), см. разведку
    // 2026-08-11: фронт /section/{slug}/ шлёт их именно так при вводе в поля "От"/"До"
    const priceQuery = [
        minPrice !== undefined ? `minPrice=${minPrice}` : null,
        maxPrice !== undefined ? `maxPrice=${maxPrice}` : null,
    ].filter(Boolean).join('&');
    const url = `${API_BASE}/catalog/products?slug=${encodeURIComponent(slug)}&orderBy=${orderBy}&direction=${direction}&page=${page}&pageSize=${pageSize}&promotion=${encodeURIComponent(promotion)}${propsQuery ? `&${propsQuery}` : ''}${priceQuery ? `&${priceQuery}` : ''}`;
    return cy.request({
        method: 'GET',
        url,
        headers: { ...DEFAULT_HEADERS, 'X-Mechta-Device-Id': 'cypress-test-device', ...headers },
        failOnStatusCode,
    });
}

// Найти значение фильтра (group.slug + item.slug) в теле ответа /catalog/filter
export function findFilterItem(filterBody, groupSlug, itemSlug) {
    const group = filterBody.properties.find((p) => p.slug === groupSlug);
    return group?.items.find((i) => i.slug === itemSlug);
}
