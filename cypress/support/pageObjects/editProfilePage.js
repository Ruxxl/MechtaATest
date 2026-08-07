// Модалка "Редактировать данные" на /cabinet/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: testcases_edit_profile_mechta.xlsx (листы "Редактировать
// данные" TC-001..087, "API" TC-API-001..038, "Комбинации полей" TC-CMB-001..027).
//
// РАЗВЕДКА 2026-08-07 (см. project_lk_testing_d2_stand memory) — реальный контракт
// расходится с частью допущений xlsx:
// - Открытие: GET http://api.d.im.mdev.kz/v3/profile → {fields:[{name,label,
//   placeholder,type,value,validation[],data{}}]}.
// - Сохранение: PUT (не POST/PATCH — xlsx сам был не уверен в методе) на тот же
//   URL. Тело: {firstname,lastname,birthdate,gender,email} — gender ОТПРАВЛЯЕТСЯ
//   СТРОКОЙ ("1"/"2"), хотя GET отдаёт его числом. contact_phone НИКОГДА не
//   отправляется (поле disabled). Успех — 204 БЕЗ ТЕЛА; обновлённые данные
//   фронт узнаёт только повторным GET, который он сам и делает сразу после PUT.
// - Реальная валидация 422 подтверждена для: пустое/только-пробелы firstname/
//   lastname ("Поле X является обязательным."), будущая дата рождения
//   ("validation.before_or_equal"), некорректный email ("email должен быть
//   действительным адресом электронной почты."), gender вне {1,2}
//   ("validation.in").
// - БАГ (см. BUG-024): цифры/HTML-теги/"&" в firstname/lastname дают 204
//   (успех), но значение НЕ сохраняется — тихий no-op без единой ошибки,
//   фронт при этом показывает тот же тост "Успешно", что и при реальном
//   сохранении.
// - Дата рождения — НЕ текстовый инпут, а <button> (popover-триггер календаря,
//   Reka UI). Прямой ввод даты вручную (TC-030 и т.п.) через календарь не
//   тестируется здесь — см. рекомендацию самого xlsx (Примечание №11) тестировать
//   такие кейсy напрямую через API. РАЗВЕДКА 2026-08-07 самого календаря
//   (claude-in-chrome + javascript_tool, вручную): каждая ячейка дня — это
//   `<div data-slot="cellTrigger" data-value="YYYY-MM-DD" aria-disabled="...">`
//   внутри `<td>`; дни позже `data.max` из GET корректно имеют
//   `aria-disabled="true"` и НЕ реагируют на клик (граница работает надёжно —
//   багов не найдено). Кнопки навигации — `button[aria-label="Next month"]`/
//   `"Previous month"`/`"Next year"`/`"Previous year"`; "Next month"/"Next year"
//   корректно становятся `disabled` на месяце, где лежит `data.max` (нельзя
//   пролистать в полностью будущий месяц). Навигация по месяцам БЕЗ клика по
//   дню не меняет значение поля при закрытии попапа (TC-041 — ОК). Комбинация
//   Имя+Дата в одном сохранении — ОК, обе применяются одним PUT-запросом
//   (TC-CMB-002 — ОК).
// - Пол — реальный <select name="gender"> под кастомной кнопкой-комбобоксом;
//   визуально скрыт, доступен через force-select.

class EditProfilePage {
    // ---------- Открытие/закрытие ----------

    visitAndOpen() {
        cy.visit('http://d2.im.mdev.kz/cabinet/');
        cy.contains(/^\+7/).should('be.visible');
        cy.get('h2').first().click();
        this.getHeading().should('be.visible');
    }

    getHeading() {
        return cy.contains('Редактировать данные');
    }

    close() {
        cy.get('body').type('{esc}');
    }

    closeByX() {
        this.getHeading().parents('div').first().find('button').first().click();
    }

    // ---------- Поля ----------

    getFirstnameInput() {
        return cy.get('input[name="firstname"]');
    }

    getLastnameInput() {
        return cy.get('input[name="lastname"]');
    }

    // Два input[name="email"] на странице (форма подписки в футере + модалка,
    // портализованная в конец <body>) — модальное поле последнее в document order.
    getEmailInput() {
        return cy.get('input[name="email"]').last();
    }

    getPhoneInput() {
        return cy.get('input[name="contact_phone"]');
    }

    getBirthdateButton() {
        return cy.contains('button', /\d{4}|Дата рождения/);
    }

    getGenderSelect() {
        return cy.get('select[name="gender"]');
    }

    // ---------- Календарь (Дата рождения) ----------

    openCalendar() {
        this.getBirthdateButton().click();
        return this;
    }

    getCalendarNextMonthButton() {
        return cy.get('button[aria-label="Next month"]');
    }

    getCalendarPrevMonthButton() {
        return cy.get('button[aria-label="Previous month"]');
    }

    getCalendarNextYearButton() {
        return cy.get('button[aria-label="Next year"]');
    }

    getCalendarDayCell(isoDate) {
        return cy.get(`[data-value="${isoDate}"]`);
    }

    // Календарь при открытии показывает месяц ТЕКУЩЕГО значения поля, не
    // обязательно месяц искомой даты — домётываем вперёд по одному месяцу,
    // пока искомый день не появится в сетке. maxSteps — защита от бесконечного
    // цикла, если дата в принципе недостижима (например, опечатка в isoDate).
    scrollCalendarToDate(isoDate, maxSteps = 36) {
        const step = (n) => {
            if (n > maxSteps) {
                throw new Error(`scrollCalendarToDate: не нашли ${isoDate} за ${maxSteps} шагов`);
            }
            cy.get('body').then(($body) => {
                if ($body.find(`[data-value="${isoDate}"]`).length > 0) return;
                this.getCalendarNextMonthButton().click();
                step(n + 1);
            });
        };
        step(0);
        return this;
    }

    // Открывает календарь, домётывает до нужной даты и кликает по ней.
    selectCalendarDate(isoDate) {
        this.openCalendar();
        this.scrollCalendarToDate(isoDate);
        this.getCalendarDayCell(isoDate).click();
        return this;
    }

    // Закрывает открытый попап календаря кликом по нейтральной области формы
    // (НЕ Esc — Esc закрывает всю модалку целиком, а не только попап).
    closeCalendarPopoverOnly() {
        cy.contains('Учетные данные').click({ force: true });
        return this;
    }

    setFirstname(value) {
        this.getFirstnameInput().clear();
        if (value) this.getFirstnameInput().type(value);
        return this;
    }

    setLastname(value) {
        this.getLastnameInput().clear();
        if (value) this.getLastnameInput().type(value);
        return this;
    }

    setEmail(value) {
        this.getEmailInput().clear();
        if (value) this.getEmailInput().type(value);
        return this;
    }

    // value: 'Мужской' | 'Женский'
    selectGender(value) {
        this.getGenderSelect().select(value, { force: true });
        return this;
    }

    // ---------- Сохранение / ошибки / тост ----------

    getSaveButton() {
        return cy.contains('button', 'Сохранить');
    }

    save() {
        this.getSaveButton().click();
        return this;
    }

    getSuccessToast() {
        return cy.contains('Успешно');
    }

    getFieldError(text) {
        return cy.contains(text);
    }
}

export default EditProfilePage;
