// Прямые запросы к реальному backend API акций в обход UI.
//
// ВАЖНО (обнаружено разведкой 2026-08-03): фронтенд на ЛЮБОМ домене, включая
// preprod pp.yc.mechta.kz, всегда обращается напрямую к https://www.mechta.kz —
// отдельного бэкенда на самом preprod-домене нет (запрос к pp.yc.mechta.kz/api/...
// напрямую curl'ом просто вернёт HTML страницы, а не JSON).
//
// ВАЖНО №2: механизм смены города — это заголовок X-City-Code (значение —
// slug города в НИЖНЕМ регистре, например "astana"), а НЕ cookie selectedCity.
// Реальный перехваченный запрос браузера не содержит cookie selectedCity вовсе,
// а вот X-City-Code отправляется всегда. Это опровергает предположение из
// тест-кейсов (лист "Вопросы к требованиям", вопрос №11).
const API_BASE = 'https://www.mechta.kz/api/v3';

export function getPromotions(qs = {}, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/promotions`,
        qs,
        headers: { Accept: 'application/json', 'X-City-Code': 'astana', ...headers },
        failOnStatusCode,
    });
}

// slugPathSegment передаётся как есть (без дополнительного кодирования) —
// это нужно для негативных кейсов, где мы намеренно контролируем сырую строку пути
export function getPromotionCategoriesRaw(slugPathSegment, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_BASE}/promotions/${slugPathSegment}/categories`,
        headers: { Accept: 'application/json', 'X-City-Code': 'astana', ...headers },
        failOnStatusCode,
    });
}

export function getPromotionCategories(slug, options = {}) {
    return getPromotionCategoriesRaw(encodeURIComponent(slug), options);
}

// Сумма promotionTypes[].count (кроме code === 'all') должна равняться
// promotionTypes[all].count и meta.totalCount — это базовый контракт API
export function assertPromotionTypesSumMatchesTotal(body) {
    const all = body.promotionTypes.find((t) => t.code === 'all');
    const sumWithoutAll = body.promotionTypes
        .filter((t) => t.code !== 'all')
        .reduce((sum, t) => sum + t.count, 0);

    expect(all, 'promotionTypes должен содержать code=all').to.exist;
    expect(sumWithoutAll, 'сумма count всех типов (кроме all)').to.eq(all.count);
    expect(body.meta.totalCount, 'meta.totalCount').to.eq(all.count);
}
