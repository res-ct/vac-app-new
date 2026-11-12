import { GLOBAL_HOLIDAYS, CURRENT_YEAR } from './constants';

export const parseDateLocalObj = (dateStr: string | Date) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const parseDateLocal = (dateStr: string | Date) => parseDateLocalObj(dateStr).getTime();

export const STANDARD_HOLIDAY_DATES = [
    '01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01',
    '23-02', '08-03', '01-05', '09-05', '12-06', '04-11'
];

export const isHoliday = (d: Date, hConfig: any = GLOBAL_HOLIDAYS) => {
    const year = d.getFullYear();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const yearHolidays = (hConfig && hConfig[year]) || STANDARD_HOLIDAY_DATES;
    return yearHolidays.includes(dateStr);
};

export const isWeekend = (d: Date, hConfig: any = GLOBAL_HOLIDAYS) => d.getDay() === 0 || d.getDay() === 6 || isHoliday(d, hConfig);

export const countBillableDays = (s: string | Date, e: string | Date, hConfig: any = GLOBAL_HOLIDAYS) => {
    if (!s || !e) return 0;
    let c = 0, cur = parseDateLocalObj(s), end = parseDateLocalObj(e);
    while (cur <= end) {
        if (!isHoliday(cur, hConfig)) c++;
        cur.setDate(cur.getDate() + 1);
    }
    return c;
};

export const countBillableDaysForYear = (s: string | Date, e: string | Date, targetYear: number, hConfig: any = GLOBAL_HOLIDAYS) => {
    if (!s || !e) return 0;
    let c = 0, cur = parseDateLocalObj(s), end = parseDateLocalObj(e);
    while (cur <= end) {
        if (cur.getFullYear() === targetYear && !isHoliday(cur, hConfig)) c++;
        cur.setDate(cur.getDate() + 1);
    }
    return c;
};

export interface AccruedQuotaResult {
    quota: number;
    isHireYear: boolean;
    isBeforeHire: boolean;
    isFullYear: boolean;
    workedMonths: number;
    hireYear?: number;
    reason: string;
}

export const calculateAccruedQuotaForYear = (
    user: any,
    targetYear: number,
    standardRate: number = 28
): AccruedQuotaResult => {
    if (!user) {
        return {
            quota: standardRate,
            isHireYear: false,
            isBeforeHire: false,
            isFullYear: true,
            workedMonths: 12,
            reason: 'Стандартная квота'
        };
    }

    const hireDateStr = typeof user.hireDate === 'string' ? user.hireDate.trim() : '';
    if (!hireDateStr) {
        return {
            quota: standardRate,
            isHireYear: false,
            isBeforeHire: false,
            isFullYear: true,
            workedMonths: 12,
            reason: 'Стандартная квота (дата найма не указана)'
        };
    }

    const parts = hireDateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return {
            quota: standardRate,
            isHireYear: false,
            isBeforeHire: false,
            isFullYear: true,
            workedMonths: 12,
            reason: 'Стандартная квота'
        };
    }

    const hireYear = parts[0];
    const hireMonth = parts[1]; // 1 - 12
    const hireDay = parts[2];   // 1 - 31

    if (targetYear < hireYear) {
        return {
            quota: 0,
            isHireYear: false,
            isBeforeHire: true,
            isFullYear: false,
            workedMonths: 0,
            hireYear,
            reason: `До даты приема на работу (${hireDateStr})`
        };
    }

    if (targetYear === hireYear) {
        // По ТК РФ (ст. 121, 122): если в месяце трудоустройства отработано 15 и более дней,
        // этот месяц засчитывается как полный. За каждый полный месяц положено 28 / 12 = 2.333 дн.
        const workedMonths = hireDay <= 15 ? (12 - hireMonth + 1) : (12 - hireMonth);
        const validMonths = Math.max(0, Math.min(12, workedMonths));
        const accruedDays = Math.round(validMonths * (standardRate / 12));

        return {
            quota: accruedDays,
            isHireYear: true,
            isBeforeHire: false,
            isFullYear: validMonths === 12,
            workedMonths: validMonths,
            hireYear,
            reason: `Год приема: отработано ${validMonths} мес. из 12 (принят ${hireDateStr})`
        };
    }

    // targetYear > hireYear: полноценный рабочий год
    return {
        quota: standardRate,
        isHireYear: false,
        isBeforeHire: false,
        isFullYear: true,
        workedMonths: 12,
        hireYear,
        reason: 'Полноценный рабочий год (28 дней)'
    };
};

export interface UserVacationYearStats {
    year: number;
    yearlyQuota: number;
    carryOverDays: number;
    totalAllowance: number;
    usedDays: number;
    pendingDays: number;
    draftDays: number;
    remainingDays: number;
    availableWithoutDrafts: number;
    isHireYear?: boolean;
    isBeforeHire?: boolean;
    workedMonths?: number;
    quotaReason?: string;
}

export const calculateUserVacationStatsForYear = (
    user: any,
    vacations: any[],
    holidays: any = GLOBAL_HOLIDAYS,
    targetYear: number
): UserVacationYearStats => {
    if (!user) {
        return {
            year: targetYear,
            yearlyQuota: 28,
            carryOverDays: 0,
            totalAllowance: 28,
            usedDays: 0,
            pendingDays: 0,
            draftDays: 0,
            remainingDays: 28,
            availableWithoutDrafts: 28
        };
    }

    const defaultQuota = Number(user.yearlyAllowance ?? 28);
    const getQuotaInfoForYear = (y: number) => {
        // 1. Explicit admin configuration for year y takes priority
        if (user.yearlyQuotas && user.yearlyQuotas[y] !== undefined) {
            return {
                quota: Number(user.yearlyQuotas[y]),
                isHireYear: false,
                isBeforeHire: false,
                reason: `Установлено вручную (${user.yearlyQuotas[y]} дн.)`
            };
        }

        // 2. If hireDate is present, calculate accurately for each year
        if (user.hireDate) {
            const accrued = calculateAccruedQuotaForYear(user, y, 28);
            if (accrued.isBeforeHire) {
                return { quota: 0, isHireYear: false, isBeforeHire: true, reason: accrued.reason };
            }
            if (accrued.isHireYear) {
                // If user profile has a specific non-standard allowance configured, use it, otherwise accrued
                const finalQuota = (user.yearlyAllowance !== undefined && Number(user.yearlyAllowance) !== 28)
                    ? Number(user.yearlyAllowance)
                    : accrued.quota;
                return {
                    quota: finalQuota,
                    isHireYear: true,
                    isBeforeHire: false,
                    workedMonths: accrued.workedMonths,
                    reason: accrued.reason
                };
            }
            // For subsequent years after hire year (e.g. 2027 when hired in 2026) -> Full standard year: 28 days!
            return {
                quota: 28,
                isHireYear: false,
                isBeforeHire: false,
                workedMonths: 12,
                reason: 'Полноценный рабочий год (28 дней)'
            };
        }

        return {
            quota: defaultQuota,
            isHireYear: false,
            isBeforeHire: false,
            reason: 'Стандартная квота'
        };
    };

    const getQuotaForYear = (y: number) => getQuotaInfoForYear(y).quota;

    const initialCarryOver = user.carryOvers && user.carryOvers[CURRENT_YEAR] !== undefined
        ? Number(user.carryOvers[CURRENT_YEAR])
        : Number(user.carryOverDays ?? 0);

    const baseYear = Math.min(CURRENT_YEAR, targetYear);
    const userVacs = (vacations || []).filter((v: any) => v.userId === user.id && v.status !== 'rejected');

    let accumulatedCarryOver = initialCarryOver;

    for (let y = baseYear; y < targetYear; y++) {
        // If an explicit carryover is configured for year y, use it as baseline
        if (user.carryOvers && user.carryOvers[y] !== undefined) {
            accumulatedCarryOver = Number(user.carryOvers[y]);
        }

        let approvedInY = 0;
        let pendingInY = 0;

        userVacs.forEach((v: any) => {
            const billable = countBillableDaysForYear(v.startDate, v.endDate, y, holidays);
            if (v.status === 'approved') approvedInY += billable;
            else if (v.status === 'pending') pendingInY += billable;
        });

        const allowanceInY = getQuotaForYear(y) + accumulatedCarryOver;
        const unusedInY = Math.max(0, allowanceInY - approvedInY - pendingInY);
        accumulatedCarryOver = unusedInY;
    }

    // If explicit carryover was set by admin for targetYear, prioritize it!
    if (user.carryOvers && user.carryOvers[targetYear] !== undefined) {
        accumulatedCarryOver = Number(user.carryOvers[targetYear]);
    }

    const targetQuotaInfo = getQuotaInfoForYear(targetYear);
    const yearlyQuota = targetQuotaInfo.quota;

    let usedInTarget = 0;
    let pendingInTarget = 0;
    let draftInTarget = 0;

    userVacs.forEach((v: any) => {
        const billable = countBillableDaysForYear(v.startDate, v.endDate, targetYear, holidays);
        if (v.status === 'approved') usedInTarget += billable;
        else if (v.status === 'pending') pendingInTarget += billable;
        else if (v.status === 'draft') draftInTarget += billable;
    });

    const totalAllowance = yearlyQuota + accumulatedCarryOver;
    const remainingDays = totalAllowance - usedInTarget - pendingInTarget - draftInTarget;
    const availableWithoutDrafts = totalAllowance - usedInTarget - pendingInTarget;

    return {
        year: targetYear,
        yearlyQuota,
        carryOverDays: accumulatedCarryOver,
        totalAllowance,
        usedDays: usedInTarget,
        pendingDays: pendingInTarget,
        draftDays: draftInTarget,
        remainingDays,
        availableWithoutDrafts,
        isHireYear: targetQuotaInfo.isHireYear,
        isBeforeHire: targetQuotaInfo.isBeforeHire,
        workedMonths: (targetQuotaInfo as any).workedMonths,
        quotaReason: targetQuotaInfo.reason
    };
};

export const calculateSuggestedCarryOver = (
    user: any,
    vacations: any[],
    holidays: any = GLOBAL_HOLIDAYS,
    targetYear: number
) => {
    const prevYear = targetYear - 1;
    const prevStats = calculateUserVacationStatsForYear(user, vacations, holidays, prevYear);
    const prevApprovedUsed = prevStats.usedDays;
    const prevAllowance = prevStats.totalAllowance;
    const suggestedCarryOver = Math.max(0, prevAllowance - prevApprovedUsed);

    return {
        prevYear,
        prevAllowance,
        prevApprovedUsed,
        prevPending: prevStats.pendingDays,
        suggestedCarryOver
    };
};

export const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

export const getApproverForUser = (user: any, users: any[]) => {
    if (!user || !users) return null;
    if (user.role === 'admin' || user.role === 'ceo') return null; 
    if (user.role === 'manager') return users.find(u => u.role === 'ceo') || users.find(u => u.role === 'admin');
    const deptManager = users.find(u => u.department === user.department && u.role === 'manager');
    return deptManager || users.find(u => u.role === 'ceo') || users.find(u => u.role === 'admin');
};
