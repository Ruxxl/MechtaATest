// Личный кабинет — обзорная страница /cabinet/ на тестовом стенде d2.im.mdev.kz.
// ВАЖНО: реальный URL — /cabinet/, а НЕ /profile (последний отдаёт 404 —
// расхождение с тест-планом, подтверждено разведкой 2026-08-06).
const CABINET_URL = 'http://d2.im.mdev.kz/cabinet/';

class CabinetPage {
    visit() {
        cy.visit(CABINET_URL);
    }

    // ---------- Хлебные крошки ----------

    getBreadcrumbNav() {
        return cy.get('nav[aria-label="breadcrumb"]');
    }

    // ВАЖНО (разведка 2026-08-06, см. BUG-001): на /cabinet/ DOM реально
    // содержит 3 li[data-slot="item"] — третий ("cabinet", нужный span
    // текущей страницы) скрыт классом `hidden` на ВНУТРЕННЕМ span, а не на
    // самом <li> (поэтому jQuery :visible его не отфильтровывает — li
    // формально не display:none). Явно исключаем li с hidden-потомком —
    // так тест отражает то, что реально видит пользователь (2 крошки).
    getBreadcrumbItems() {
        return this.getBreadcrumbNav().find('li[data-slot="item"]')
            .filter((_, li) => !li.querySelector('.hidden'));
    }

    // Полный список, включая скрытые — нужен отдельно для теста BUG-001,
    // который целенаправленно проверяет и скрытый span тоже.
    getAllBreadcrumbItemsIncludingHidden() {
        return this.getBreadcrumbNav().find('li[data-slot="item"]');
    }

    // ---------- Заголовок / профиль ----------

    getH1() {
        return cy.get('h1');
    }

    // ФИО пользователя рендерится как первый h2 на странице (в блоке профиля слева)
    getProfileNameHeading() {
        return cy.get('h2').first();
    }

    // Клик на блок ФИО открывает модалку "Редактировать данные" — сам h2 внутри
    // кликабельной обёртки целиком (сверено разведкой: клик по заголовку срабатывает).
    // ВАЖНО: блок профиля грузится асинхронно и до загрузки на его месте skeleton
    // без реального <h2> — в этот момент "первый h2 на странице" может оказаться
    // другим статичным блоком (напр. "Мечта ГИД"). Поэтому сначала дожидаемся
    // явного признака загрузки данных профиля — номера телефона (+7 ...).
    openEditProfilePanel() {
        cy.contains(/^\+7/).should('be.visible');
        this.getProfileNameHeading().click();
    }

    // Модалка не имеет отдельного контейнера с уникальным data-slot, идентифицируем
    // по заголовку "Редактировать данные" и берём общего родителя-диалог
    getEditProfileModalHeading() {
        return cy.contains('Редактировать данные');
    }

    closeEditProfilePanel() {
        cy.get('body').type('{esc}');
    }

    // ---------- Сгорание бонусов/фишек ----------

    getBurnBlock() {
        return cy.contains(/сгор[ия]т/);
    }

    // ---------- Боковое меню ----------

    // nav[1] — сам список пунктов ЛК (nav[0] — верхний хлебнокрошечный/другой);
    // сверено разведкой: второй <nav> на странице содержит два <ul> — основные
    // пункты и (Избранное/Сравнение/Выйти)
    getSidebarNav() {
        return cy.get('nav').eq(1);
    }

    clickSidebarItem(text) {
        this.getSidebarNav().contains('li', text).click();
    }

    clickLogout() {
        this.getSidebarNav().contains('li', 'Выйти').click();
    }

    // ---------- Блоки "Моё избранное" / "Оставьте отзыв" / "Мечта ГИД" ----------

    getFavoritesTeaserHeading() {
        return cy.contains('h2', 'Моё избранное');
    }

    getReviewsTeaserHeading() {
        return cy.contains('h2', 'Оставьте отзыв');
    }

    getMechtaGuideHeading() {
        return cy.contains('h2', 'Мечта ГИД');
    }

    // ---------- "Вы недавно смотрели" ----------

    getRecentlyViewedHeading() {
        return cy.contains('h3', 'Вы недавно смотрели');
    }

    getRecentlyViewedCards() {
        return cy.get('a[href^="/product/"]');
    }
}

export default CabinetPage;
export { CABINET_URL };
