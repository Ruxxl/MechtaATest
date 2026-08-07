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
// Конфигуратор товара акций типа "Предзаказ" — отдельный, более старый namespace
// API (v2, не v3), обнаружен разведкой 2026-08-07 через performance.getEntriesByType
// на реальной странице акции "umnye-naushniki-s-ii-chipom"
const API_V2_BASE = 'https://www.mechta.kz/api/v2';

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

// Живой полный список ВСЕХ акций, независимо от текущего totalCount (он меняется
// день ото дня — 2026-08-07 было 21, но НЕЛЬЗЯ хардкодить это число). Обходит все
// страницы /promotions рекурсивно, попутно нормализуя уже известную особенность
// контракта (страница 1 отдаёт "promotions" как массив, следующие страницы — как
// JSON-объект {"0": {...}, "1": {...}}, см. README раздела «Акции»).
function normalizePromotionsList(promotions) {
    return Array.isArray(promotions) ? promotions : Object.values(promotions);
}

// Строит карту slug -> type.code, опрашивая /promotions?type=X для каждого РЕАЛЬНОГО
// типа (кроме агрегата "all") — сам список акций НЕ отдаёт поле type на каждом
// элементе напрямую (только агрегированные счётчики в promotionTypes), поэтому
// единственный способ узнать тип конкретной акции через API — сходить в фильтр по
// каждому типу и посмотреть, какие slug'и туда попадают. Опирается на факт, что
// акция принадлежит РОВНО одному типу (см. assertPromotionTypesSumMatchesTotal —
// сумма count всех типов, кроме all, равна totalCount, то есть разбиение без
// пересечений), иначе один slug мог бы получить два разных типа в карте.
export function getPromotionTypeMap() {
    return getPromotions({ page: 1 }).then((res) => {
        const types = res.body.promotionTypes.filter((t) => t.code !== 'all');
        const fetchType = (index, acc) => {
            if (index >= types.length) return acc;
            const type = types[index];
            return getAllPromotions({ type: type.code }).then((promos) => {
                promos.forEach((p) => { acc[p.slug] = type.code; });
                return fetchType(index + 1, acc);
            });
        };
        return fetchType(0, {});
    });
}

export function getAllPromotions(qs = {}) {
    const fetchPage = (page, acc) =>
        getPromotions({ ...qs, page }).then((res) => {
            const merged = acc.concat(normalizePromotionsList(res.body.promotions));
            if (page < res.body.meta.totalPages) {
                return fetchPage(page + 1, merged);
            }
            return merged;
        });
    return fetchPage(1, []);
}

// Форматирование дат акции в точности так, как их рендерит фронтенд (подтверждено
// разведкой 2026-08-07 на реальной странице): "1 августа 2026 г.", т.е. genitive-форма
// месяца на русском без ведущего нуля у дня. Парсим дату вручную по частям, а НЕ через
// `new Date(str)` — у ответа API нет таймзоны в строке ("2026-08-01 00:00:00"), и
// `new Date()` в браузере интерпретировал бы её в локальной таймзоне, рискуя сдвинуть
// день на соседние сутки.
const RU_MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatRuDate(apiDateStr) {
    const [year, month, day] = apiDateStr.split(' ')[0].split('-').map(Number);
    return `${day} ${RU_MONTHS_GENITIVE[month - 1]} ${year} г.`;
}

export function formatRuDateRange(fromDate, toDate) {
    return `с ${formatRuDate(fromDate)} по ${formatRuDate(toDate)}`;
}

// Данные конфигуратора акции-предзаказа: дерево выбираемых параметров (filters)
// и сами товары-варианты (preorder_products), на которые они ссылаются через
// product_id. Используется для акций типа "Предзаказ" (см. getPromotionTypeMap) —
// у них детальная страница вместо обычной сетки категорий показывает виджет
// "Выберите параметры" (переключатель цвета/памяти/etc. конкретного товара).
export function getPreorderProducts(slug, { headers = {}, failOnStatusCode = true } = {}) {
    return cy.request({
        method: 'GET',
        url: `${API_V2_BASE}/actions/${slug}/preorder-products`,
        headers: { Accept: 'application/json', 'X-City-Code': 'astana', ...headers },
        failOnStatusCode,
    });
}

// Дерево `filters` вложено ПО ОДНОМУ значению на уровень (каждый уровень — это
// один фиксированный параметр вида "Версия Bluetooth: 6.1"), КРОМЕ самого глубокого
// уровня — там сразу несколько веток, это и есть реально выбираемые варианты
// товара (например разные цвета), и только у элементов этого уровня есть
// product_id. Раскручиваем дерево рекурсивно до этого уровня — так работает для
// любой акции-предзаказа независимо от того, на каком по счёту параметре у неё
// происходит реальное ветвление (не обязательно на цвете).
export function findSelectableVariants(filters) {
    if (!filters || filters.length === 0) return [];
    if (filters.length > 1 || filters[0].product_id !== undefined) {
        return filters;
    }
    return findSelectableVariants(filters[0].items);
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
