import './commands';

require('cypress-xpath');

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
            onRequest(req) {
                console.log('Intercepted request:', req); // Проверяем, перехвачен ли запрос
            }
        }
    );

    cy.viewport(2560, 1440);

    Cypress.on('uncaught:exception', (err) => {
        if (
            err.message.includes('Request failed with status code 400') || // Игнорируем ошибки 400
            err.message.includes("Cannot read properties of undefined (reading 'status')") ||
            err.message.includes("Cannot read properties of undefined (reading 'add')") ||
            err.message.includes("Cannot read properties of undefined (reading 'app')") ||
            err.message.includes("Cannot read properties of undefined (reading 'app')") ||
            err.message.includes("VK is not defined") ||
            err.message.includes("Cannot read properties of null (reading 'document')") // Ошибки null
        ) {
            return false; // Не прерывать тест
        }
        return true; // Все остальные ошибки не контролируем
    });
});