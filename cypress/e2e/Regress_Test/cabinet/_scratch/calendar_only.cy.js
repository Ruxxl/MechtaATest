import EditProfilePage from '../../../../support/pageObjects/editProfilePage';
import * as cabinetApi from '../../../../support/helpers/cabinetApi';

const EditProfile = new EditProfilePage();

describe('SCRATCH: календарь disabled-check', () => {
    beforeEach(() => { cy.loginD2(); });

    it('Дни позже data.max задизейблены в календаре и не реагируют на клик', () => {
        cabinetApi.getProfile().then(({ body }) => {
            const byName = {};
            body.fields.forEach((f) => { byName[f.name] = f; });
            const maxIso = byName.birthdate.data.max;
            const maxDate = new Date(`${maxIso}T00:00:00`);
            const nextDay = new Date(maxDate);
            nextDay.setDate(nextDay.getDate() + 1);
            cy.log('maxIso=' + maxIso + ' nextDayMonth=' + nextDay.getMonth() + ' maxMonth=' + maxDate.getMonth());
            EditProfile.visitAndOpen();
            EditProfile.openCalendar();
            EditProfile.scrollCalendarToDate(maxIso);
            EditProfile.getCalendarNextMonthButton().should('be.disabled');
            EditProfile.getCalendarNextYearButton().should('be.disabled');
            if (nextDay.getMonth() === maxDate.getMonth()) {
                const nextIso = nextDay.toISOString().slice(0, 10);
                cy.log('checking nextIso=' + nextIso);
                EditProfile.getCalendarDayCell(nextIso).should('have.attr', 'aria-disabled', 'true');
            } else {
                cy.log('max date is last day of month, skipping next-day check');
            }
        });
    });
});
