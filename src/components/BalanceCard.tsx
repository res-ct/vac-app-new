import React, { useState, useMemo } from 'react';
import { PieChart, Clock, FileText, PlusCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { calculateUserVacationStatsForYear } from '../lib/utils';
import { CURRENT_YEAR } from '../lib/constants';
import { CarryOverModal } from './CarryOverModal';

interface BalanceCardProps {
    year?: number;
    onYearChange?: (year: number) => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ year: externalYear, onYearChange }) => {
    const { currentUser: user, vacations, holidays } = useAppContext();
    const [internalYear, setInternalYear] = useState<number>(externalYear || CURRENT_YEAR);
    const [isCarryOverModalOpen, setIsCarryOverModalOpen] = useState(false);

    const activeYear = externalYear !== undefined ? externalYear : internalYear;

    const handlePrevYear = () => {
        const newY = activeYear - 1;
        if (onYearChange) onYearChange(newY);
        else setInternalYear(newY);
    };

    const handleNextYear = () => {
        const newY = activeYear + 1;
        if (onYearChange) onYearChange(newY);
        else setInternalYear(newY);
    };

    const stats = useMemo(() => {
        return calculateUserVacationStatsForYear(user, vacations, holidays, activeYear);
    }, [user, vacations, holidays, activeYear]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <PieChart className="w-4 h-4 text-indigo-600" /> Баланс отпусков
                </h3>
                {/* Year Switcher */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                    <button 
                        onClick={handlePrevYear} 
                        className="p-1 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded transition-colors"
                        title="Предыдущий год"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-gray-800 px-1">{activeYear} г.</span>
                    <button 
                        onClick={handleNextYear} 
                        className="p-1 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded transition-colors"
                        title="Следующий год"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100/50">
                    <div className="text-[11px] text-blue-600 font-medium mb-1">Всего доступно</div>
                    <div className="text-xl font-bold text-blue-800">{stats.totalAllowance}</div>
                    <div className="text-[10px] text-blue-500 mt-0.5">
                        {stats.yearlyQuota} + {stats.carryOverDays} пер.
                    </div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100/50">
                    <div className="text-[11px] text-green-600 font-medium mb-1">Одобрено</div>
                    <div className="text-xl font-bold text-green-800">{stats.usedDays}</div>
                    <div className="text-[10px] text-green-600 mt-0.5">дней</div>
                </div>
                <div className={`p-3 rounded-lg text-center border ${stats.remainingDays < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className={`text-[11px] font-medium mb-1 ${stats.remainingDays < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        Остаток
                    </div>
                    <div className={`text-xl font-bold ${stats.remainingDays < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                        {stats.remainingDays}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${stats.remainingDays < 0 ? 'text-red-500' : 'text-emerald-600'}`}>дней</div>
                </div>
            </div>

            {stats.isHireYear && (
                <div className="mb-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-2 text-center text-xs">
                    <b>{activeYear} г.</b> — год приема на работу. Квота рассчитана за {stats.workedMonths} мес. ({stats.yearlyQuota} дн.). В {activeYear + 1} году квота составит полные 28 дней.
                </div>
            )}
            {stats.pendingDays > 0 && (
                <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-center gap-2 text-xs text-amber-800">
                    <Clock className="w-3 h-3 text-amber-600" /> На согласовании в {activeYear} г.: <b>{stats.pendingDays}</b> дн.
                </div>
            )}
            {stats.draftDays > 0 && (
                <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center justify-center gap-2 text-xs text-gray-600">
                    <FileText className="w-3 h-3" /> В черновиках на {activeYear} г.: <b>{stats.draftDays}</b> дн.
                </div>
            )}

            {user?.role === 'admin' && (
                <div className="pt-3 border-t border-gray-100 text-center">
                    <button
                        type="button"
                        onClick={() => setIsCarryOverModalOpen(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                        <PlusCircle className="w-3 h-3" />
                        Настроить квоту и остаток (Администратор)
                    </button>
                </div>
            )}

            {user?.role === 'admin' && (
                <CarryOverModal
                    isOpen={isCarryOverModalOpen}
                    onClose={() => setIsCarryOverModalOpen(false)}
                    targetUser={user}
                    initialYear={activeYear}
                />
            )}
        </div>
    );
};
