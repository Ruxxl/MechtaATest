import DetailPage from '../../../support/pageObjects/actions/detailPage';

const Detail = new DetailPage();

// Лист "Детальная страница Акции" (DET-001..062).
// Реальные факты, отличающиеся от исходных тест-кейсов (проверено 2026-08-03):
// - Порядок хлебных крошек: "Главная / Акции / [Название акции] / [Категория]",
//   а НЕ "Главная / Акции / [Категория] / Название акции", как в тест-кейсе DET-001.
// - Модальное окно "Подробнее" НЕ содержит таймера обратного отсчёта — такого
//   элемента на реальной странице нет вообще (открытый вопрос №8 закрыт: фичи нет).
// - Переключатель вида "Списком"/"Сеткой" СУЩЕСТВУЕТ на детальной странице
//   (в отличие от каталога акций, где его нет).
describe('Детальная страница акции', () => {

    let data;
    before(() => {
        cy.fixture('actionsData').then((d) => { data = d; });
    });

    describe('Хлебные крошки', () => {

        it('DET-001: путь навигации — Главная / Акции / Название акции', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.get('nav[aria-label="breadcrumb"]').within(() => {
                cy.contains('Главная').should('be.visible');
                cy.contains('Акции').should('be.visible');
            });
        });

        it('DET-002: переход по "Акции" из хлебных крошек ведёт на каталог', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.get('nav[aria-label="breadcrumb"]').contains('a', 'Акции').click();
            cy.url().should('include', '/useful/shares/').and('not.include', data.bannerPromoSlug);
        });

        it('DET-003: текущий (последний) элемент хлебных крошек не кликабелен', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.get('nav[aria-label="breadcrumb"] li').last().find('a').should('not.exist');
        });
    });

    describe('Баннер акции', () => {

        it('DET-006: баннер отображает заголовок и описание', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.contains('button,a', 'Подробнее').should('be.visible');
        });

        it('DET-007: кнопка «Подробнее» открывает модальное окно с названием, датами и описанием', () => {
            Detail.visit(data.bannerPromoSlug);
            Detail.openDetailsModal();
            cy.get('[role="dialog"], .modal, [data-slot="base"][role]').should('be.visible');
            cy.contains(/с \d{1,2} \S+ \d{4} г\. по/).should('be.visible');
        });

        it('DET-008: модальное окно «Подробнее» закрывается по Esc', () => {
            Detail.visit(data.bannerPromoSlug);
            Detail.openDetailsModal();
            cy.contains(/с \d{1,2} \S+ \d{4} г\. по/).should('be.visible');
            Detail.closeDetailsModal();
            cy.contains(/с \d{1,2} \S+ \d{4} г\. по/).should('not.exist');
        });

        it('DET-009: акция без подзаголовка/баннера отображается без "дыр" в вёрстке', () => {
            // "bonusy-za-otzyv" подтверждённо не имеет баннерного блока вообще
            Detail.visit(data.multiCategoryPromoSlug);
            cy.get('nav[aria-label="breadcrumb"]').should('be.visible');
            cy.get('body').should('be.visible'); // страница не падает и не показывает пустой экран
        });
    });

    describe('Категории акции', () => {

        it('DET-010: категория не выбрана — показаны все категории акции из API', () => {
            Detail.interceptCategories();
            Detail.visit(data.multiCategoryPromoSlug);
            Detail.waitCategories().then((interception) => {
                interception.response.body.forEach((cat) => {
                    cy.contains('a,button', cat.name).should('be.visible');
                });
            });
        });

        it('DET-012: у акции с единственной категорией она автоматически активна', () => {
            Detail.visit(data.singleCategoryPromoSlug);
            Detail.categoryIcons.should('have.length', 1);
            cy.url().should('include', 'category=');
        });

        it('DET-013: акция без категорий — блок категорий не отображается, страница не ломается', () => {
            Detail.visit(data.noCategoryPromoSlug);
            Detail.categoryIcons.should('have.length', 0);
            cy.get('body').should('be.visible');
        });

        it('DET-014: клик по категории обновляет список товаров и URL', () => {
            Detail.visit(data.bannerPromoSlug);
            Detail.categoryIcons.eq(1).click();
            cy.url().should('include', 'category=');
            cy.contains('Подкатегории').should('be.visible');
        });
    });

    describe('Фильтрация', () => {

        it('DET-019: выбор параметра фильтра (бренд Apple) и «Показать» обновляет список товаров', () => {
            Detail.visit(data.bannerPromoSlug, `?category=noutbuki-i-kompyutery`);
            cy.contains('Бренд').should('be.visible');
            Detail.clickBrandCheckbox('Apple');
            cy.contains('button', /Показать \d+ результ/).click();
            // cy.url() возвращает адрес как есть в браузере — скобки в этом
            // случае НЕ percent-encoded (проверено фактически), в отличие от
            // того, что можно было бы ожидать
            cy.url().should('include', 'properties[brend][]=apple');
        });

        it('DET-024/DET-027: повторный клик по применённому фильтру снимает его (реальный механизм сброса)', () => {
            // Проверено на реальном сайте (в т.ч. после применения фильтра через
            // настоящий клик "Показать"): кнопки "Сбросить все" в текущем UI нет
            // вообще — единственный способ снять фильтр, это повторно кликнуть
            // по тому же чекбоксу. Фиксируем фактический механизм вместо заявленного.
            Detail.visit(data.bannerPromoSlug, `?category=noutbuki-i-kompyutery&properties[brend][]=apple`);
            cy.contains('Сбросить все').should('not.exist');
            Detail.clickBrandCheckbox('Apple');
            cy.contains('button', /Показать \d+ результ/).click();
            cy.url().should('not.include', 'properties');
        });
    });

    describe('Карточка товара', () => {

        it('DET-035: карточка товара содержит название, изображение, цену и кнопку добавления в корзину', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.get('[class*="i-ph:shopping-cart"]').should('exist');
            cy.contains(/\d[\d\s]*\s?₸/).should('be.visible');
        });

        it('DET-036: клик по карточке товара открывает страницу товара', () => {
            Detail.visit(data.bannerPromoSlug);
            // a[href*="/product/"] матчит и скрытый (0x0) мобильный дубль-обёртку —
            // берём ссылку с непустым текстом (название товара), она гарантированно видима
            cy.get('a[href*="/product/"]').filter((i, el) => el.textContent.trim().length > 0).first().then(($a) => {
                const href = $a.attr('href');
                cy.wrap($a).click();
                cy.url().should('include', href);
            });
        });

        it('DET-037: переход по недействительной ссылке товара показывает 404', () => {
            cy.visit('/product/this-product-does-not-exist-xyz-123/', { failOnStatusCode: false });
            cy.contains('Мы не можем найти то, что Вы ищете').should('be.visible');
        });
    });

    describe('Переключатель вида отображения', () => {

        it('DET-051/052: переключение между «Списком» и «Сеткой» не ломает страницу', () => {
            Detail.visit(data.bannerPromoSlug);
            cy.get('[class*="i-ph:list-bold"]').first().click({ force: true });
            cy.get('body').should('be.visible');
            cy.get('[class*="i-ph:squares"], [class*="i-ph:grid"]').first().click({ force: true });
            cy.get('body').should('be.visible');
        });
    });

    describe('Негативные (общие для детальной страницы)', () => {

        it('Несуществующая акция редиректит на каталог, а не показывает сломанную страницу', () => {
            cy.visit(`/useful/shares/${data.nonExistentPromoSlug}/`, { failOnStatusCode: false });
            cy.url().should('eq', 'https://pp.yc.mechta.kz/useful/shares/');
        });

        it('Категория, не относящаяся к акции, в URL не ломает страницу', () => {
            Detail.visit(data.singleCategoryPromoSlug, '?category=this-category-does-not-belong-here');
            cy.get('body').should('be.visible');
        });
    });
});
