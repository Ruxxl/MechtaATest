import EditProfilePage from '../../../support/pageObjects/editProfilePage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const EditProfile = new EditProfilePage();

// Модалка "Редактировать данные" (/cabinet/), тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: testcases_edit_profile_mechta.xlsx — листы
// "Редактировать данные" (TC-001..087), "API" (TC-API-001..038),
// "Комбинации полей" (TC-CMB-001..027). Полная разведка сетевых запросов
// (открытие/сохранение/обновление) — см. project_lk_testing_d2_stand memory
// и комментарий в начале editProfilePage.js.
//
// БАЗОВОЕ состояние тестового аккаунта (восстанавливается после каждого
// мутирующего теста, чтобы не ломать остальные спеки ЛК):
const BASELINE = {
    firstname: 'Джон',
    lastname: 'Appleseed',
    birthdate: '2026-06-18',
    gender: '1',
    email: 'ivanov@gmail.com',
};

function restoreBaseline() {
    return cabinetApi.putProfile(BASELINE, { failOnStatusCode: false });
}

describe('Редактирование профиля — открытие модалки, контракт GET /v3/profile', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-API-001, TC-API-002 — структура ответа
    it('GET /v3/profile возвращает fields[] с ожидаемой схемой полей', () => {
        cabinetApi.getProfile().then(({ status, body }) => {
            expect(status).to.eq(200);
            expect(body).to.have.property('fields').that.is.an('array');

            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });

            ['firstname', 'lastname', 'birthdate', 'gender', 'contact_phone', 'email'].forEach((name) => {
                expect(byName, `поле ${name} присутствует`).to.have.property(name);
                const f = byName[name];
                expect(f).to.have.all.keys('name', 'label', 'placeholder', 'type', 'value', 'validation', 'data');
            });

            expect(byName.firstname.validation).to.include('required');
            expect(byName.lastname.validation).to.include('required');
            expect(byName.contact_phone.validation).to.include('required');
            expect(byName.email.validation).to.include('email');
            // ВАЖНО: email НЕ помечен required в реальном контракте API, вопреки
            // допущению TC-058 — поэтому его не проверяем как required здесь.
            expect(byName.contact_phone.data.disabled).to.eq(true);
        });
    });

    // TC-API-003 — значения в UI 1:1 совпадают со значениями из API
    it('Поля модалки предзаполнены значениями из GET /v3/profile (Имя/Фамилия/Email)', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            EditProfile.visitAndOpen();
            EditProfile.getFirstnameInput().should('have.value', fields.firstname);
            EditProfile.getLastnameInput().should('have.value', fields.lastname);
            EditProfile.getEmailInput().should('have.value', fields.email);
        });
    });

    // TC-API-006, TC-042 — value=1 в API соответствует выбранному "Мужской" на UI
    it('Пол в дропдауне соответствует value/options из API (1 → «Мужской»)', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            expect(fields.gender, 'baseline: пол = Мужской (1)').to.eq(1);
            EditProfile.visitAndOpen();
            cy.contains('Мужской').should('be.visible');
        });
    });

    // TC-API-004 — ISO-дата из API отображается в человекочитаемом формате без сдвига дня
    it('Дата рождения из API (ISO) отображается в формате «D месяц YYYY» без сдвига', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            expect(fields.birthdate, 'baseline: дата рождения').to.eq('2026-06-18');
            EditProfile.visitAndOpen();
            cy.contains('18 июня 2026').should('be.visible');
        });
    });

    // TC-047, TC-API-007 — телефон disabled согласно data.disabled из API
    it('Поле «Телефон» задизейблено согласно data.disabled из API', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });
            expect(byName.contact_phone.data.disabled, 'baseline: телефон disabled в API').to.eq(true);
            EditProfile.visitAndOpen();
            EditProfile.getPhoneInput().should('be.disabled');
        });
    });

    // TC-048 — задизейбленное поле не реагирует на ввод
    it('Поле «Телефон» не принимает ввод (disabled)', () => {
        EditProfile.visitAndOpen();
        EditProfile.getPhoneInput().should('be.disabled');
        EditProfile.getPhoneInput().type('9999999999', { force: true }).then(() => {
            // type с force на disabled-инпуте не должен ничего изменить в значении
        });
        EditProfile.getPhoneInput().invoke('val').should('not.include', '9999999999');
    });
});

describe('Редактирование профиля — позитивное сохранение', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    afterEach(() => {
        restoreBaseline();
    });

    // TC-001 — сохранение имени, реальное сохранение проверяем через API
    it('Изменение Имени сохраняется (проверено через API) и показывает тост «Успешно»', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Пётр');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).firstname).to.eq('Пётр');
        });
    });

    // TC-065, TC-CMB-001 — Имя, Фамилия и Email одновременно, за один запрос
    it('Комбинированное изменение Имени, Фамилии и Email сохраняет все поля разом', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Пётр');
        EditProfile.setLastname('Сидоров');
        EditProfile.setEmail('petr.sidorov@gmail.com');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            expect(fields.firstname).to.eq('Пётр');
            expect(fields.lastname).to.eq('Сидоров');
            expect(fields.email).to.eq('petr.sidorov@gmail.com');
        });
    });

    // TC-042/044 — смена пола
    it('Смена пола на «Женский» сохраняется', () => {
        EditProfile.visitAndOpen();
        EditProfile.selectGender('Женский');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).gender).to.eq(2);
        });
    });
});

describe('Редактирование профиля — синхронизация после сохранения (TC-080..083)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    afterEach(() => {
        restoreBaseline();
    });

    // TC-080 — было БАГ-025: карточка ФИО в сайдбаре не обновлялась без
    // перезагрузки страницы. Исправлено, подтверждено 2026-08-10 (Jira
    // AS-4530 → «Готово») — теперь обновляется без reload, с задержкой
    // ~1-2 сек после сохранения; ловится штатным retry `cy.should`.
    it('Карточка профиля обновляется сразу после сохранения, без перезагрузки', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Пётр');
        EditProfile.setLastname('Сидоров');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');

        cy.get('h2').first().should('have.text', 'Пётр Сидоров');
    });

    // TC-081 — данные персистентны на бэкенде (подтверждается повторным GET после
    // reload)
    it('После F5 карточка профиля и API отдают уже сохранённые данные', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Пётр');
        EditProfile.setLastname('Сидоров');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');

        cy.reload();
        cy.get('h2').first().should('have.text', 'Пётр Сидоров');
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            expect(fields.firstname).to.eq('Пётр');
            expect(fields.lastname).to.eq('Сидоров');
        });
    });

    // TC-083 — изменено только Имя, Фамилия не менялась — объединяются без потери
    // данных. Проверяем через API + reload (живое обновление h2 без reload уже
    // покрыто тестом выше).
    it('Изменение только Имени не затирает несвязанную Фамилию', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Пётр');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');
        cabinetApi.getProfile().then(({ body }) => {
            const fields = cabinetApi.profileFieldsMap(body);
            expect(fields.firstname).to.eq('Пётр');
            expect(fields.lastname).to.eq(BASELINE.lastname);
        });
        cy.reload();
        cy.get('h2').first().should('have.text', 'Пётр Appleseed');
    });

    // TC-086 — баланс бонусов/фишек не меняется от правки профиля
    it('Баланс бонусов/фишек не меняется после сохранения профиля', () => {
        EditProfile.visitAndOpen();
        cy.contains('Ваш баланс').parents('div').first().find('h2').then(($before) => {
            const before = $before.map((_, el) => el.textContent).get();
            EditProfile.setFirstname('Пётр');
            EditProfile.save();
            EditProfile.getSuccessToast().should('be.visible');
            cy.contains('Ваш баланс').parents('div').first().find('h2').then(($after) => {
                const after = $after.map((_, el) => el.textContent).get();
                expect(after).to.deep.equal(before);
            });
        });
    });
});

describe('Редактирование профиля — клиентская валидация (без запроса на сервер)', () => {
    beforeEach(() => {
        cy.loginD2();
        EditProfile.visitAndOpen();
    });

    // TC-006
    it('Пустое обязательное поле «Имя» блокирует сохранение с сообщением об ошибке', () => {
        EditProfile.setFirstname('');
        EditProfile.save();
        cy.contains('Заполните поле').should('be.visible');
        EditProfile.getSuccessToast().should('not.exist');
    });

    // TC-007 — БАГ (см. BUG-026): пробелы НЕ отфильтровываются клиентом (в отличие
    // от полностью пустого поля) — реальный PUT уходит на сервер, сервер корректно
    // отвечает 422 "Поле firstname является обязательным.", но UI вместо этого
    // сообщения показывает не относящийся к делу тост "Ошибка получения данных".
    // Тест ожидает содержательное сообщение об ошибке поля и падает, пока не
    // исправлено.
    it('Только пробелы в поле «Имя» — сервер отклоняет с 422, UI должен показать причину (BUG-026)', () => {
        EditProfile.setFirstname('   ');
        EditProfile.save();
        cy.contains('Заполните поле').should('be.visible');
        EditProfile.getSuccessToast().should('not.exist');
    });

    // TC-055
    it('Email без «@» блокирует сохранение с сообщением о некорректном формате', () => {
        EditProfile.setEmail('ivanovgmail.com');
        EditProfile.save();
        cy.contains('Введите корректный email').should('be.visible');
        EditProfile.getSuccessToast().should('not.exist');
    });
});

// БЫЛ БАГ-024 («тихий silent-drop»): цифры/HTML в firstname/lastname давали
// `204`, но значение не сохранялось. Перепроверено 2026-08-10 (curl + этот
// же спек) — поведение воспроизводится 1-в-1, НЕ исправлено технически. По
// решению пользователя 2026-08-10 это ИСКЛЮЧЕНИЕ признано ожидаемым
// поведением (не баг) — BugReport-файл удалён, тесты ниже переведены из
// "падает, пока не почини" в "фиксирует принятый контракт".
describe('Редактирование профиля — цифры/HTML в имени приняты сервером без ошибки (было БАГ-024)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    afterEach(() => {
        restoreBaseline();
    });

    // TC-008/TC-012/TC-030 — в отличие от остальных невалидных случаев на этом
    // эндпоинте (пустое имя, будущая дата, битый email, неверный gender — все
    // дают 422), цифры/HTML в имени сервер принимает с `204` и просто не
    // применяет изменение (значение остаётся прежним). Признано ожидаемым.
    it('PUT /v3/profile с цифрами в firstname отвечает 204 и оставляет прежнее значение', () => {
        cabinetApi.putProfile({ ...BASELINE, firstname: 'Иван123' }, { failOnStatusCode: false }).then((res) => {
            expect(res.status).to.eq(204);
        });
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).firstname).to.eq(BASELINE.firstname);
        });
    });

    // Тот же контракт для Фамилии. Значение поля после этого запроса может
    // быть либо прежним, либо очищенным санитайзером — оба варианта приняты,
    // проверяем только код ответа, чтобы не зависеть от этой нестабильности.
    it('PUT /v3/profile с XSS-пейлоадом в lastname отвечает 204', () => {
        cabinetApi.putProfile({ ...BASELINE, lastname: '<script>alert(1)</script>' }, { failOnStatusCode: false }).then((res) => {
            expect(res.status).to.eq(204);
        });
    });

    // Через реальный UI: тост "Успешно" на этой странице сам скрывается через
    // несколько секунд (auto-dismiss) — поэтому используем надёжную
    // позитивную проверку `.should('be.visible')` (с retry-ability), а не
    // `.should('not.exist')`.
    it('UI показывает тост «Успешно» при сохранении цифр в Имени, значение остаётся прежним', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('Иван123');
        EditProfile.save();
        EditProfile.getSuccessToast().should('be.visible');
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).firstname).to.eq(BASELINE.firstname);
        });
    });
});

describe('Редактирование профиля — серверная валидация напрямую через API', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    afterEach(() => {
        restoreBaseline();
    });

    // TC-032, TC-API-022 — будущая дата рождения корректно отклоняется 422.
    // ВАЖНО: дата вычисляется динамически (+1 год от сегодня), НЕ хардкод —
    // хардкоженная дата в прошлом стала бы валидной сама по себе, стоит
    // стенду дожить до неё (обнаружено 2026-08-11: ранее захардкоженная
    // "будущая" '2026-08-08' протухла и тест начал ложно падать).
    it('Будущая дата рождения отклоняется с 422 и не сохраняется', () => {
        const futureBirthdate = new Date();
        futureBirthdate.setFullYear(futureBirthdate.getFullYear() + 1);
        const futureBirthdateStr = futureBirthdate.toISOString().slice(0, 10);
        cabinetApi.putProfile({ ...BASELINE, birthdate: futureBirthdateStr }, { failOnStatusCode: false }).then((res) => {
            expect(res.status).to.eq(422);
            expect(res.body.error.code).to.eq('validation_error');
        });
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).birthdate).to.eq(BASELINE.birthdate);
        });
    });

    // TC-API-024 — gender вне словаря options корректно отклоняется 422
    it('Значение gender вне {1,2} отклоняется с 422 и не сохраняется', () => {
        cabinetApi.putProfile({ ...BASELINE, gender: '3' }, { failOnStatusCode: false }).then((res) => {
            expect(res.status).to.eq(422);
        });
        cabinetApi.getProfile().then(({ body }) => {
            expect(cabinetApi.profileFieldsMap(body).gender).to.eq(1);
        });
    });

    // TC-API-021 — попытка сменить disabled-поле contact_phone напрямую через API игнорируется
    it('contact_phone, отправленный в обход UI, игнорируется сервером', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const before = cabinetApi.profileFieldsMap(body).contact_phone;
            cabinetApi.putProfile({ ...BASELINE, contact_phone: '77011112233' }).then((res) => {
                expect(res.status).to.eq(204);
            });
            cabinetApi.getProfile().then(({ body: body2 }) => {
                expect(cabinetApi.profileFieldsMap(body2).contact_phone).to.eq(before);
            });
        });
    });

    // TC-API-029 — пустое тело возвращает понятную ошибку по обязательным полям
    it('Пустое тело запроса на сохранение возвращает 422 со списком обязательных полей', () => {
        cabinetApi.putProfile({}, { failOnStatusCode: false }).then((res) => {
            expect(res.status).to.eq(422);
            expect(res.body.error.message).to.include('firstname');
        });
    });
});

describe('Редактирование профиля — закрытие без сохранения (TC-069, TC-046)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-069 — крестик/Esc закрывает модалку без сохранения изменений
    it('Esc закрывает модалку без сохранения — при повторном открытии видны исходные данные', () => {
        EditProfile.visitAndOpen();
        EditProfile.setFirstname('НЕ ДОЛЖНО СОХРАНИТЬСЯ');
        EditProfile.close();
        EditProfile.getHeading().should('not.exist');

        cy.get('h2').first().click();
        EditProfile.getHeading().should('be.visible');
        EditProfile.getFirstnameInput().should('have.value', BASELINE.firstname);
    });
});

describe('Редактирование профиля — прочее поведение формы', () => {
    beforeEach(() => {
        cy.loginD2();
        EditProfile.visitAndOpen();
    });

    // TC-078 — фактическое поведение: кнопка "Сохранить" активна даже без единого
    // изменения полей (не задизейблена по умолчанию) — задокументировано как факт,
    // xlsx сам обозначил это как "если так задумано по UX".
    it('Кнопка «Сохранить» активна сразу при открытии, без внесения изменений (факт поведения)', () => {
        EditProfile.getSaveButton().should('not.be.disabled');
    });
});

// Разведка 2026-08-07 (claude-in-chrome + javascript_tool, вручную) — сам
// календарь отработал корректно на всех проверенных сценариях, багов НЕ
// найдено. `data.max` из GET /v3/profile — динамическая дата (обычно
// "сегодня" стенда), поэтому тесты вычисляют её через API, а не хардкодят.
describe('Редактирование профиля — календарь «Дата рождения» (TC-029..041, TC-CMB-002)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    afterEach(() => {
        restoreBaseline();
    });

    // TC-029, TC-031 — выбор ровно максимально допустимой даты (границы
    // включительно) через реальный календарь сохраняется корректно
    it('Выбор максимально допустимой даты (data.max) через календарь сохраняется', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });
            const maxIso = byName.birthdate.data.max;

            EditProfile.visitAndOpen();
            EditProfile.selectCalendarDate(maxIso);
            EditProfile.closeCalendarPopoverOnly();
            EditProfile.save();
            EditProfile.getSuccessToast().should('be.visible');

            cabinetApi.getProfile().then(({ body: body2 }) => {
                expect(cabinetApi.profileFieldsMap(body2).birthdate).to.eq(maxIso);
            });
        });
    });

    // TC-API-005 — дни позже data.max недоступны для выбора прямо в UI
    // календаря (не только на сервере) — граница дублируется на фронте
    it('Дни позже data.max задизейблены в календаре и не реагируют на клик', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });
            const maxIso = byName.birthdate.data.max;
            const maxDate = new Date(`${maxIso}T00:00:00`);
            const nextDay = new Date(maxDate);
            nextDay.setDate(nextDay.getDate() + 1);

            EditProfile.visitAndOpen();
            EditProfile.openCalendar();
            EditProfile.scrollCalendarToDate(maxIso);

            // Кнопки "дальше" недоступны на месяце, где лежит максимальная дата
            EditProfile.getCalendarNextMonthButton().should('be.disabled');
            EditProfile.getCalendarNextYearButton().should('be.disabled');

            // Если максимальная дата — не последний день месяца, день сразу
            // после неё должен быть в сетке и быть задизейбленным.
            // ВАЖНО: .toISOString() тут нельзя — она конвертирует в UTC, а
            // машина, где гоняются тесты, в зоне +05 (Алматы), из-за чего
            // локальная полночь nextDay съезжает на предыдущий UTC-день и
            // nextIso совпадает с самой maxIso (разрешённой) датой вместо
            // следующей за ней — собираем ISO-строку из локальных
            // компонентов даты вручную.
            if (nextDay.getMonth() === maxDate.getMonth()) {
                const pad = (n) => String(n).padStart(2, '0');
                const nextIso = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;
                EditProfile.getCalendarDayCell(nextIso).should('have.attr', 'aria-disabled', 'true');
            }
        });
    });

    // TC-041 — открыть календарь, полистать месяцы, закрыть БЕЗ выбора дня —
    // исходное значение поля не меняется
    it('Навигация по месяцам без выбора дня не меняет значение поля', () => {
        EditProfile.visitAndOpen();
        EditProfile.getBirthdateButton().invoke('text').then((before) => {
            EditProfile.openCalendar();
            EditProfile.getCalendarPrevMonthButton().click().click().click();
            EditProfile.closeCalendarPopoverOnly();
            EditProfile.getBirthdateButton().should('contain.text', before.trim());
        });
    });

    // TC-CMB-002 — Имя и Дата рождения меняются одновременно, сохраняются
    // одним запросом
    it('Комбинированное изменение Имени и Даты рождения сохраняется одним запросом', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });
            const maxIso = byName.birthdate.data.max;

            EditProfile.visitAndOpen();
            EditProfile.setFirstname('ПётрКалендарь');
            EditProfile.selectCalendarDate(maxIso);
            EditProfile.closeCalendarPopoverOnly();
            EditProfile.save();
            EditProfile.getSuccessToast().should('be.visible');

            cabinetApi.getProfile().then(({ body: body2 }) => {
                const fields = cabinetApi.profileFieldsMap(body2);
                expect(fields.firstname).to.eq('ПётрКалендарь');
                expect(fields.birthdate).to.eq(maxIso);
            });
        });
    });
});
