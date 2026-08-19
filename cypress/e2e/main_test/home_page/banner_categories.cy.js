import HomePage from '../../../support/pageObjects/home_page';

const homePage = new HomePage();

// Главная страница — блок «Баннер-карусель» и «Популярные категории».
// Разведка 2026-08-18 (живой браузер + javascript_tool DOM-инспекция):
// - Баннер: GET /api/v3/publications/banners — плоский массив
//   {url, mobile, tablet, desktop, desktopXL, name}. Точки пагинации —
//   button[aria-label="Go to slide N"] (N с 1), по одной на баннер.
//   Стрелки Prev/Next (button[aria-label="Prev"/"Next"]) в DOM есть, но
//   visible:false по умолчанию (показываются по hover) — кликаем force.
//   Каждый баннер дублирован в DOM (mobile+desktop копии, тот же паттерн,
//   что и везде в проекте) — картинки шире 800px и с offsetParent!==null
//   надёжно вычленяют видимую (десктопную) копию.
// - Категории: GET /api/v3/popular/categories — [{title,url,image,...}].
//   Кнопка «Все категории» — это <button>, не <a> (JS-навигация на
//   /section/ «Каталог товаров»).

describe('Главная — Баннер-карусель', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/v3/publications/banners').as('banners');
        cy.visit('/');
    });

    it('Количество точек-пагинаторов соответствует количеству баннеров из API', () => {
        cy.wait('@banners').then(({ response }) => {
            const banners = response.body;
            expect(Array.isArray(banners), 'baseline: непустой список баннеров').to.be.true;
            expect(banners.length).to.be.greaterThan(0);

            banners.forEach((_, i) => {
                cy.get(`button[aria-label="Go to slide ${i + 1}"]`).should('exist');
            });
            cy.get(`button[aria-label="Go to slide ${banners.length + 1}"]`).should('not.exist');
        });
    });

    it('Каждый баннер — видимая кликабельная ссылка на реальный url из API (без query-параметров)', () => {
        cy.wait('@banners').then(({ response }) => {
            const banners = response.body;
            // Видимые (десктопные, не mobile-дубль) баннерные картинки — широкие (>800px)
            cy.get('img').filter((_, img) => img.width > 800 && img.offsetParent !== null).then(($imgs) => {
                expect($imgs.length, 'видимых баннеров столько же, сколько в API').to.eq(banners.length);
                [...$imgs].forEach((img, i) => {
                    const href = img.closest('a')?.getAttribute('href') || '';
                    const hrefPath = href.split('?')[0];
                    const apiPath = banners[i].url.split('?')[0];
                    expect(hrefPath, `баннер ${i + 1}: ссылка совпадает с API`).to.eq(apiPath);
                });
            });
        });
    });

    it('Клик по точке-пагинатору 2 переключает активный слайд', () => {
        cy.wait('@banners');
        // Точки дублируются в DOM (mobile+desktop копии карусели, тот же
        // паттерн, что и везде в проекте) — cy.click() отказывается кликать
        // по multi-element subject, берём явно видимую копию.
        cy.get('button[aria-label="Go to slide 1"]').filter(':visible').invoke('attr', 'class').then((classBefore) => {
            cy.get('button[aria-label="Go to slide 2"]').filter(':visible').click();
            cy.wait(500);
            cy.get('button[aria-label="Go to slide 1"]').filter(':visible').invoke('attr', 'class').should((classAfter) => {
                expect(classAfter, 'класс первой точки должен измениться (стала неактивной)').to.not.eq(classBefore);
            });
        });
    });

    it('Стрелка "Next" листает карусель вперёd (клик force, т.к. стрелки скрыты до hover)', () => {
        // Стрелка Next НЕ дублирована в DOM (единственный элемент,
        // подтверждено разведкой) — в отличие от точек-пагинаторов,
        // фильтр по :visible ей не нужен (и сломал бы клик — она скрыта
        // до hover по дизайну, поэтому и так по force).
        cy.wait('@banners');
        cy.get('button[aria-label="Go to slide 1"]').filter(':visible').invoke('attr', 'class').then((classBefore) => {
            cy.get('button[aria-label="Next"]').click({ force: true });
            cy.wait(500);
            cy.get('button[aria-label="Go to slide 1"]').filter(':visible').invoke('attr', 'class').should((classAfter) => {
                expect(classAfter, 'после Next первый слайд должен стать неактивным').to.not.eq(classBefore);
            });
        });
    });

    it('НЕГАТИВ: GET /api/v3/publications/banners — 500 не роняет страницу (категории под баннером всё равно видны)', () => {
        cy.intercept('GET', '**/api/v3/publications/banners', { statusCode: 500, body: {} }).as('bannersError');
        cy.visit('/');
        cy.wait('@bannersError');
        cy.contains('Популярные категории').should('be.visible');
        cy.get('main').should('not.contain.text', 'undefined');
    });
});

describe('Главная — Популярные категории', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/v3/popular/categories').as('popularCategories');
        cy.visit('/');
    });

    it('Плитки категорий соответствуют GET /api/v3/popular/categories (анонимная сессия)', () => {
        homePage.checkPopularCategories();
    });

    it('Плитки категорий соответствуют API для авторизованного пользователя', () => {
        cy.login();
        cy.visit('/');
        homePage.checkPopularCategories();
    });

    it('Клик по плитке категории открывает соответствующую страницу', () => {
        cy.wait('@popularCategories').then(({ response }) => {
            const first = response.body[0];
            const urlPath = new URL(first.url).pathname;
            // Плитки тоже дублированы в DOM (mobile-only копия с display:none) —
            // .first() без фильтра по видимости может попасть на скрытую.
            cy.get(`a[href*="${urlPath}"]`).filter(':visible').first().click();
            cy.url().should('include', urlPath);
        });
    });

    it('Кнопка "Все категории" ведёт на /section/ (полный каталог)', () => {
        cy.contains('button', 'Все категории').click();
        cy.url().should('include', '/section/');
        cy.contains('h1', 'Каталог товаров').should('be.visible');
    });

    it('НЕГАТИВ: GET /api/v3/popular/categories — 500 не роняет страницу, соседние блоки видны', () => {
        cy.intercept('GET', '**/api/v3/popular/categories', { statusCode: 500, body: {} }).as('categoriesError');
        cy.visit('/');
        cy.wait('@categoriesError');
        homePage.header.should('be.visible');
        cy.get('main').should('not.contain.text', 'undefined');
    });

    it('НЕГАТИВ: пустой список категорий из API не ломает страницу', () => {
        cy.intercept('GET', '**/api/v3/popular/categories', { statusCode: 200, body: [] }).as('categoriesEmpty');
        cy.visit('/');
        cy.wait('@categoriesEmpty');
        cy.get('main').should('not.contain.text', 'undefined');
    });
});
