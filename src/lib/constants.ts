export const CURRENT_YEAR = new Date().getFullYear();
export const DEFAULT_HOLIDAYS: Record<string, string[]> = { [CURRENT_YEAR]: ['01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01', '23-02', '08-03', '01-05', '09-05', '12-06', '04-11'], [CURRENT_YEAR + 1]: ['01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01', '23-02', '08-03', '01-05', '09-05', '12-06', '04-11'] };
export let GLOBAL_HOLIDAYS: Record<string, string[]> = { ...DEFAULT_HOLIDAYS };
export const setGlobalHolidays = (data: any) => {
    GLOBAL_HOLIDAYS = { ...DEFAULT_HOLIDAYS, ...data };
};
export const DEFAULT_AUTH_SETTINGS = { password: true, google: true, yandex: true };
export const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const FULL_MONTHS = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const INITIAL_DEPARTMENTS_DATA = [{ name: 'IT Отдел' }, { name: 'Продажи' }, { name: 'Бухгалтерия' }, { name: 'HR' }, { name: 'Управление' }];
export const INITIAL_USERS_DATA = [
  { id: 100, name: 'Стив Джобс', email: 'ceo@example.com', department: 'Управление', avatar: 'СД', role: 'ceo', yearlyAllowance: 28, carryOverDays: 0, hireDate: `${CURRENT_YEAR - 5}-01-01`, password: '123' },
  { id: 999, name: 'HR Администратор', email: 'admin@example.com', department: 'HR', avatar: 'AD', role: 'admin', yearlyAllowance: 0, carryOverDays: 0, hireDate: `${CURRENT_YEAR - 2}-01-01`, password: 'admin' }
];
