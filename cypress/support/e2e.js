import './commands';

// Список всех доменов и эндпоинтов для перехвата
const interceptedDomains = [
    // Google Analytics
    'www.google-analytics.com',
    'analytics.google.com',
    'www.google.com/ccm/collect',
    // Yandex
    'mc.yandex.ru',
    'yandex.ru',
    // Amplitude
    'api.lab.amplitude.com',
    'api2.amplitude.com',
    'sr-client-cfg.amplitude.com',
    // Mindbox
    'personalization-web-stable.mindbox.ru',
    'api.mindbox.ru/v1.1/customer/track-visit?version=1.0.676&transport=XmlHttpRequest',
    'api.mindbox.ru',
    'web-static.mindbox.ru/js/byendpoint/mechtawebsite.js?_=', // timestamp динамический
    // Другие сервисы
    'autocomplete.diginetica.net',
    'ams.creativecdn.com',
    'privacy-cs.mail.ru',
    'api.mdev.kz',
    'ad.doubleclick.net',
    'o4509365431369728.ingest.us.sentry.io',
    'api.iconify.design',
    'www.facebook.com',
    'cdn-cgi'
];

// Собираем RegExp автоматически
const urlRegex = new RegExp(`https:\\/\\/(${interceptedDomains.map(d => d.replace(/\//g, '\\/')).join('|')}).*`);

beforeEach(() => {
    cy.intercept(
        {
            method: /POST|GET|HEAD/, // Перехватываем POST, GET и HEAD
            url: urlRegex,
        },
        {
            log: false, // Отключаем логирование
        }
    );

    cy.viewport(2560, 1440);

    Cypress.on('uncaught:exception', (err) => {
        const message = (err && err.message) || '';
        if (
            message.includes('Request failed with status code 400') || // Игнорируем ошибки 400
            message.includes("Cannot read properties of undefined (reading 'status')") ||
            message.includes("Cannot read properties of undefined (reading 'add')") ||
            message.includes("Cannot read properties of undefined (reading 'app')") ||
            message.includes("Cannot read properties of undefined (reading 'recsContainer')") || // Diginetica (cdn.diginetica.net) вешает свой click-listener на document.body и падает на чужих кликах, не имеющих отношения к его виджету

            message.includes("VK is not defined") ||
            message.includes("Cannot read properties of null (reading 'document')") || // Ошибки null
            message.includes('ResizeObserver loop completed with undelivered notifications') || // Безобидное предупреждение карты (2GIS)
            message.includes('Tracker not initialized') || // Mindbox падает сам на себя из-за наших же перехватов его запросов
            message.toLowerCase().includes('script error') || // Кросс-доменная ошибка стороннего скрипта (чат-виджет/реклама/аналитика) без деталей — не код приложения
            !message // на некоторых кросс-доменных ошибках message приходит пустым
        ) {
            return false; // Не прерывать тест
        }
        return true; // Все остальные ошибки не контролируем
    });
});