import CabinetPage, { CABINET_URL } from '../../support/pageObjects/cabinetPage';
import EditProfilePage from '../../support/pageObjects/editProfilePage';
import OrdersPage from '../../support/pageObjects/ordersPage';
import BonusesPage, { BONUSES_URL } from '../../support/pageObjects/bonusesPage';
import CardsPage, { CARDS_URL } from '../../support/pageObjects/cardsPage';
import CouponsPage, { COUPONS_URL } from '../../support/pageObjects/couponsPage';
import ReviewsPage, { REVIEWS_URL } from '../../support/pageObjects/reviewsPage';
import * as cabinetApi from '../../support/helpers/cabinetApi';

const Cabinet = new CabinetPage();
const EditProfile = new EditProfilePage();
const Orders = new OrdersPage();
const Bonuses = new BonusesPage();
const Cards = new CardsPage();
const Coupons = new CouponsPage();
const Reviews = new ReviewsPage();

// РЕГРЕСС-тест раздела «Личный кабинет»: ОДИН файл, сквозной прогон ВСЕХ
// разделов ЛК только позитивными сценариями (профиль/редактирование →
// заказы → бонусы и фишки → карты → купоны → отзывы) — предназначен для
// быстрой регулярной регрессии «всё ещё работает в целом», а не для
// разбора конкретных багов/крайних случаев (для этого — отдельные подробные
// спеки в cypress/e2e/main_test/cabinet/*.cy.js, откуда сюда переиспользованы
// те же Page Object'ы и API-хелперы, а не продублирована логика).
//
// Каждый it() сверяет UI с реальным ответом API (не только "страница
// открылась") и толерантен к пустым состояниям аккаунта (гвард + cy.log +
// return), т.к. это живой стенд и состав данных может меняться день ото дня.
describe('Личный кабинет — РЕГРЕСС: сквозной обход всех разделов, позитивные сценарии', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // ---------- 1. Обзорная страница /cabinet/ ----------

    it('REGR-LK-001: обзорная страница — заголовок, крошки, профиль, баланс, боковое меню соответствуют API', () => {
        cabinetApi.getPersonal().then(({ body }) => {
            const { profile_info, bonus_info, chips_info } = body.data;

            Cabinet.visit();

            Cabinet.getBreadcrumbItems().should('have.length', 2);
            Cabinet.getH1().should('have.length', 1).and('contain.text', 'Личный кабинет');
            Cabinet.getProfileNameHeading().should('have.text', profile_info.full_name);

            const digits = profile_info.phone.replace(/\D/g, '');
            const formatted = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
            cy.contains(formatted).should('be.visible');

            cy.get('h2').contains(String(bonus_info.active)).should('be.visible');
            cy.get('h2').contains(String(chips_info.active)).should('be.visible');

            // Боковое меню — каждый пункт присутствует и виден (сам факт
            // рендера всего меню целиком, без клика по каждому — за это
            // отвечают отдельные REGR-тесты ниже, у которых свой visit()).
            // ВАЖНО: «Цифровые товары» намеренно НЕ кликаем — живой проверкой
            // 2026-08-12 подтверждено, что пункт ничего не делает (не
            // переходит, не разворачивается) — см. отдельный баг-репорт,
            // здесь фиксируем только факт присутствия пункта в меню.
            ['Личный кабинет', 'Мои заказы', 'Цифровые товары', 'Бонусы и фишки', 'Мои карты', 'Купоны', 'Отзывы', 'Избранное', 'Сравнение', 'Выйти']
                .forEach((item) => {
                    Cabinet.getSidebarNav().contains('li', item).should('be.visible');
                });

            // «Моё избранное» — превью карточки соответствуют реальному избранному
            cabinetApi.getFavorites().then(({ body: favBody }) => {
                if (favBody.products && favBody.products.length > 0) {
                    Cabinet.getFavoritesTeaserHeading().should('be.visible')
                        .parent().find('img').should('have.length.at.least', 1);
                }
            });

            // «Оставьте отзыв» — виджет соответствует реальным товарам,
            // доступным к отзыву
            cabinetApi.getProductsForReviews().then(({ body: reviewBody }) => {
                if (reviewBody.products && reviewBody.products.length > 0) {
                    Cabinet.getReviewsTeaserHeading().should('be.visible');
                }
            });

            Cabinet.getMechtaGuideHeading().should('be.visible');

            // «Вы недавно смотрели» — карусель соответствует истории просмотров
            cabinetApi.getHistory().then(({ body: historyBody }) => {
                const items = historyBody.data || historyBody;
                if (items.length > 0) {
                    Cabinet.getRecentlyViewedHeading().should('be.visible');
                    cy.contains('a[href^="/product/"]', items[0].name).should('be.visible');
                }
            });
        });
    });

    // ---------- 2. Редактирование профиля ----------

    it('REGR-LK-002: редактирование профиля — открытие, предзаполнение, сохранение и откат', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const before = cabinetApi.profileFieldsMap(body);

            EditProfile.visitAndOpen();
            EditProfile.getHeading().should('be.visible');

            // Предзаполнение реальными данными из API
            EditProfile.getFirstnameInput().should('have.value', before.firstname);
            EditProfile.getLastnameInput().should('have.value', before.lastname);
            EditProfile.getEmailInput().should('have.value', before.email);

            // Позитивное сохранение: меняем Имя, сохраняем, видим тост,
            // карточка профиля обновляется без перезагрузки страницы
            const newFirstname = 'РегрессТест';
            EditProfile.setFirstname(newFirstname);
            EditProfile.save();
            EditProfile.getSuccessToast().should('be.visible');
            cy.get('h2').first().should('contain.text', newFirstname);

            // Откатываем изменение — не оставляем след в данных аккаунта
            // для остальных тестов этого же и других файлов
            cabinetApi.putProfile(
                { firstname: before.firstname, lastname: before.lastname, birthdate: before.birthdate, gender: String(before.gender), email: before.email },
                { failOnStatusCode: false },
            );
        });
    });

    // ---------- 3. Мои заказы ----------

    it('REGR-LK-003: «Мои заказы» — список активных соответствует API, вкладки переключаются, карточка открывается', () => {
        cabinetApi.getOrdersList({ status: 'active', page: 1, limit: 10 }).then(({ body }) => {
            const orders = body.data.orders;
            if (orders.length === 0) {
                cy.log('На аккаунте нет активных заказов — кейс пропущен');
                return;
            }

            Orders.visit();
            Orders.getActiveTab().should('have.attr', 'aria-selected', 'true');

            const first = orders[0];
            Orders.getOrderCardByNumber(first.order.id).should('be.visible')
                .and('contain.text', first.summary.title.text);

            // Переключение на «Завершенные» — реально уходит новый запрос,
            // вкладка визуально переключается
            cy.intercept('GET', '**/v2/personal/orders_list**').as('finishedTab');
            Orders.getFinishedTab().click();
            cy.wait('@finishedTab', { timeout: 40000 });
            Orders.getFinishedTab().should('have.attr', 'aria-selected', 'true');

            // Клик по карточке ведёт на детальную страницу заказа
            Orders.getActiveTab().click();
            Orders.getOrderCardByNumber(first.order.id).click();
            cy.url().should('include', `/cabinet/order`);
        });

        // Пагинация/подгрузка — если заказов на странице ровно limit,
        // элемент "Ещё заказы" обязан быть виден
        cabinetApi.getOrdersList({ status: 'active', page: 1, limit: 10 }).then(({ body }) => {
            if (body.data.orders.length === 10) {
                Orders.visit();
                Orders.getLoadMoreButton().should('be.visible');
            }
        });
    });

    // ---------- 4. Бонусы и фишки ----------

    it('REGR-LK-004: «Бонусы и фишки» — баланс и список операций соответствуют API, детали разворачиваются', () => {
        cabinetApi.getPersonal().then(({ body: personalBody }) => {
            const { bonus_info, chips_info } = personalBody.data;

            cabinetApi.getBonusesHistoryPage({ page: 1, limit: 10 }).then(({ body }) => {
                Bonuses.visit();

                cy.contains('Ваш баланс').parents('div').first().within(() => {
                    cy.contains(String(bonus_info.active)).should('be.visible');
                    cy.contains(String(chips_info.active)).should('be.visible');
                });

                const items = body.data.items;
                if (items.length === 0) {
                    cy.log('На аккаунте нет операций начисления — кейс пропущен');
                    return;
                }

                const firstItem = items[0];
                if (firstItem.order_id === 'Оффлайн заказ') {
                    cy.log('Первая операция — офлайн-заказ (неоднозначный selector) — детали пропущены');
                    return;
                }

                Bonuses.getOperationCardByOrderId(firstItem.order_id).should('be.visible').then(($card) => {
                    if ($card.text().includes('Показать детали')) {
                        Bonuses.toggleDetails($card);
                        cy.wrap($card).contains('Скрыть детали').should('be.visible');
                    }
                });

                // Нумерованная пагинация — видна, когда есть ещё страницы
                if (body.data.page_number < body.data.all_pages) {
                    Bonuses.getPageLink(1).should('be.visible');
                    Bonuses.getNextPageLink().should('be.visible');
                }
            });
        });
    });

    // ---------- 5. Мои карты ----------

    it('REGR-LK-005: «Мои карты» — список соответствует API, кнопка добавления видна', () => {
        cabinetApi.getCards().then(({ body }) => {
            const cards = body.data && body.data.cards ? body.data.cards : [];

            Cards.visit();
            Cards.getAddCardButton().should('be.visible');

            if (cards.length === 0) {
                cy.log('На аккаунте нет сохранённых карт — сверка списка пропущена');
                return;
            }

            const first = cards[0];
            const grouped = first.pan_masked.match(/.{1,4}/g).join(' ');
            cy.contains(grouped).should('be.visible');
        });
    });

    // ---------- 6. Купоны ----------

    it('REGR-LK-006: «Купоны» — вкладки переключаются, содержимое (включая пустое состояние) соответствует API', () => {
        cabinetApi.getCoupons({ filterBy: 'active' }).then(({ body }) => {
            const activeList = body.data || body;

            Coupons.visit();
            Coupons.getActiveTab().should('have.attr', 'aria-selected', 'true');

            if (Array.isArray(activeList) && activeList.length === 0) {
                cy.contains(/Нет доступных купонов/i).should('be.visible');
            }
        });

        cy.intercept('GET', '**/v3/personal/promo-codes**').as('usedTab');
        Coupons.getUsedTab().click();
        cy.wait('@usedTab', { timeout: 40000 }).then(({ response }) => {
            const list = response.body.data || response.body;
            if (Array.isArray(list) && list.length === 0) {
                cy.contains(/Нет|нет купонов|пусто/i).should('be.visible');
            }
        });
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'true');
    });

    // ---------- 7. Отзывы ----------

    it('REGR-LK-007: «Отзывы» — вкладки переключаются, статистика и список товаров к отзыву соответствуют API', () => {
        cy.intercept('GET', '**/v3/personal/reviews**').as('reviewsLoad');
        Reviews.visit();
        cy.wait('@reviewsLoad', { timeout: 40000 }).then(({ response }) => {
            const { publishedCount, likesCount } = response.body.summary;
            cy.contains(String(publishedCount)).should('be.visible');
            cy.contains(String(likesCount)).should('be.visible');
        });

        // Вкладка «Оставить отзыв» (активна по умолчанию) — реальные товары
        // к отзыву из API, каждый с карточкой на странице
        cabinetApi.getProductsForReviews().then(({ body }) => {
            if (body.products && body.products.length > 0) {
                cy.contains(body.products[0].product.name).should('be.visible');
            }
        });

        Reviews.getMyReviewsTab().click();
        Reviews.getLeaveReviewTab().should('be.visible');
        Reviews.getMyReviewsTab().click();
    });
});
