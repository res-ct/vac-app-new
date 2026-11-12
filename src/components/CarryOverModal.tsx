import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, AlertCircle, Lightbulb, ChevronLeft, ChevronRight, History, Briefcase } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { CURRENT_YEAR } from '../lib/constants';
import { calculateSuggestedCarryOver, calculateUserVacationStatsForYear, calculateAccruedQuotaForYear } from '../lib/utils';

interface CarryOverModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser?: any;
    initialYear?: number;
}

export const CarryOverModal: React.FC<CarryOverModalProps> = ({ 
    isOpen, 
    onClose, 
    targetUser, 
    initialYear = CURRENT_YEAR 
}) => {
    const { currentUser, vacations, holidays, logAction } = useAppContext();
    const effectiveUser = targetUser || currentUser;

    const [selectedYear, setSelectedYear] = useState<number>(initialYear);
    const [quotaValue, setQuotaValue] = useState<number>(28);
    const [carryOverValue, setCarryOverValue] = useState<number>(0);
    const [reason, setReason] = useState<string>('Настройка квоты и остатка');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Synchronize inputs when targetUser or selectedYear changes
    useEffect(() => {
        if (!effectiveUser) return;
        const currentStats = calculateUserVacationStatsForYear(effectiveUser, vacations, holidays, selectedYear);
        const configuredQuota = effectiveUser.yearlyQuotas && effectiveUser.yearlyQuotas[selectedYear] !== undefined
            ? Number(effectiveUser.yearlyQuotas[selectedYear])
            : currentStats.yearlyQuota;
        const configuredCarryOver = currentStats.carryOverDays;

        setQuotaValue(configuredQuota);
        setCarryOverValue(configuredCarryOver);
        setReason(`Корректировка на ${selectedYear} год`);
    }, [effectiveUser, selectedYear, vacations, holidays]);

    if (!isOpen || !effectiveUser) return null;

    const isAdmin = currentUser?.role === 'admin';
    const suggested = calculateSuggestedCarryOver(effectiveUser, vacations, holidays, selectedYear);
    const quotaAccrued = calculateAccruedQuotaForYear(effectiveUser, selectedYear, 28);
    const historyList = Array.isArray(effectiveUser.carryOverHistory) ? effectiveUser.carryOverHistory : [];
    const totalAllowanceForYear = Number(quotaValue || 0) + Number(carryOverValue || 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            alert('Только администратор имеет право изменять квоты и остатки отпусков.');
            return;
        }
        if (!effectiveUser._docId) {
            alert('Ошибка: идентификатор пользователя не найден.');
            return;
        }

        setIsSaving(true);
        try {
            const updatedYearlyQuotas = {
                ...(effectiveUser.yearlyQuotas || {}),
                [selectedYear]: Number(quotaValue)
            };

            const updatedCarryOvers = {
                ...(effectiveUser.carryOvers || {}),
                [selectedYear]: Number(carryOverValue)
            };

            const historyEntry = {
                id: Date.now().toString(),
                year: selectedYear,
                date: new Date().toLocaleDateString('ru-RU'),
                timestamp: Date.now(),
                quota: Number(quotaValue),
                carryOver: Number(carryOverValue),
                suggestedWas: suggested.suggestedCarryOver,
                note: reason || `Настройка квоты и остатка на ${selectedYear} г.`,
                addedBy: currentUser?.name || 'Администратор'
            };

            const updatedHistory = [historyEntry, ...historyList];

            const updatePayload: any = {
                yearlyQuotas: updatedYearlyQuotas,
                carryOvers: updatedCarryOvers,
                carryOverHistory: updatedHistory
            };

            // Keep base fields synchronized when editing CURRENT_YEAR
            if (selectedYear === CURRENT_YEAR) {
                updatePayload.yearlyAllowance = Number(quotaValue);
                updatePayload.carryOverDays = Number(carryOverValue);
            }

            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', effectiveUser._docId), updatePayload);

            logAction(
                'UPDATE_QUOTA_CARRYOVER',
                `Администратор настроил квоту (${quotaValue} дн.) и остаток (${carryOverValue} дн.) на ${selectedYear} год для ${effectiveUser.name}`,
                effectiveUser._docId,
                null,
                { year: selectedYear, quota: quotaValue, carryOver: carryOverValue }
            );

            setSuccessMessage(`Параметры на ${selectedYear} год успешно сохранены!`);
            setTimeout(() => {
                setSuccessMessage(null);
                onClose();
            }, 1200);
        } catch (err) {
            console.error('Error saving quota/carryover:', err);
            alert('Произошла ошибка при сохранении.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold backdrop-blur-sm">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">Квота и остаток на {selectedYear} год</h3>
                            <p className="text-xs text-blue-100 opacity-90">{effectiveUser.name} ({effectiveUser.department})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Year Selector */}
                    <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                            Целевой год:
                        </span>
                        <div className="flex items-center gap-1.5 bg-white border border-indigo-200 px-2 py-1 rounded-lg shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y - 1)}
                                className="p-1 hover:bg-indigo-50 rounded text-indigo-700 transition-colors"
                                title="Предыдущий год"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-indigo-950 px-2">
                                {selectedYear} год
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y + 1)}
                                className="p-1 hover:bg-indigo-50 rounded text-indigo-700 transition-colors"
                                title="Следующий год"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {!isAdmin ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center text-sm font-medium">
                            Просмотр параметров. Изменение квот и остатков доступно только администратору.
                        </div>
                    ) : successMessage ? (
                        <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 p-4 rounded-xl text-center text-sm font-medium flex items-center justify-center gap-2">
                            <Check className="w-5 h-5 text-emerald-600" />
                            {successMessage}
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-4">
                            {/* System Suggestion Banner based on previous year */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    Подсказка системы по итогам {suggested.prevYear} года:
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    В {suggested.prevYear} году всего было доступно <b>{suggested.prevAllowance} дн.</b>, из них согласовано отпусков на <b>{suggested.prevApprovedUsed} дн.</b>
                                </p>
                                <div className="pt-1.5 flex items-center justify-between border-t border-amber-200/60 mt-1">
                                    <span className="font-medium">
                                        Расчетный остаток: <strong className="text-amber-950 font-bold text-sm">{suggested.suggestedCarryOver} дн.</strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCarryOverValue(suggested.suggestedCarryOver)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                                    >
                                        Подставить {suggested.suggestedCarryOver} дн.
                                    </button>
                                </div>
                            </div>

                            {/* Quota context / hint based on hire date and full year */}
                            {effectiveUser.hireDate && (
                                <div className={`rounded-xl p-3.5 text-xs space-y-1.5 border ${
                                    quotaAccrued.isHireYear
                                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                                        : quotaAccrued.isBeforeHire
                                            ? 'bg-gray-100 border-gray-200 text-gray-700'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                }`}>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <Briefcase className="w-4 h-4 flex-shrink-0" />
                                        {quotaAccrued.isHireYear ? (
                                            <span>Год трудоустройства ({selectedYear} г.):</span>
                                        ) : quotaAccrued.isBeforeHire ? (
                                            <span>Год до трудоустройства:</span>
                                        ) : (
                                            <span>Полноценный рабочий год ({selectedYear} г.):</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] leading-relaxed">
                                        {quotaAccrued.isHireYear ? (
                                            <>Сотрудник принят на работу <b>{effectiveUser.hireDate}</b>. В {selectedYear} году отработано <b>{quotaAccrued.workedMonths} мес.</b> из 12. Расчетная квота по ТК РФ: <b>{quotaAccrued.quota} дн.</b></>
                                        ) : quotaAccrued.isBeforeHire ? (
                                            <>Сотрудник еще не работал в компании в {selectedYear} году (принят <b>{effectiveUser.hireDate}</b>).</>
                                        ) : (
                                            <>Сотрудник работает полный календарный год (принят {effectiveUser.hireDate}). Стандартная квота: <b>28 дн.</b></>
                                        )}
                                    </p>
                                    {quotaValue !== quotaAccrued.quota && (
                                        <div className="pt-1.5 flex items-center justify-between border-t border-current/20 mt-1">
                                            <span className="font-medium text-[11px]">
                                                Расчетная квота года: <b>{quotaAccrued.quota} дн.</b>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setQuotaValue(quotaAccrued.quota)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs transition-colors text-white ${
                                                    quotaAccrued.isHireYear
                                                        ? 'bg-blue-600 hover:bg-blue-700'
                                                        : quotaAccrued.isBeforeHire
                                                            ? 'bg-gray-600 hover:bg-gray-700'
                                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                                }`}
                                            >
                                                Подставить квоту {quotaAccrued.quota} дн.
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Inputs: Quota & Carryover for selectedYear */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">
                                        Квота на {selectedYear} г.
                                    </label>
                                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500">
                                        <input
                                            type="number"
                                            required
                                            min={0}
                                            max={365}
                                            value={quotaValue}
                                            onChange={(e) => setQuotaValue(Number(e.target.value))}
                                            className="w-full text-base font-bold text-gray-800 outline-none"
                                        />
                                        <span className="text-xs text-gray-400 ml-1">дн.</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 mt-0.5">Базовый лимит года</span>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">
                                        Остаток на {selectedYear} г.
                                    </label>
                                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500">
                                        <input
                                            type="number"
                                            required
                                            min={0}
                                            max={365}
                                            value={carryOverValue}
                                            onChange={(e) => setCarryOverValue(Number(e.target.value))}
                                            className="w-full text-base font-bold text-emerald-700 outline-none"
                                        />
                                        <span className="text-xs text-gray-400 ml-1">дн.</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 mt-0.5">Перенос прошлых лет</span>
                                </div>
                            </div>

                            {/* Summary Badge */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs text-blue-900">
                                <span>Всего доступно дней в {selectedYear} году:</span>
                                <strong className="text-sm font-bold text-blue-800">
                                    {totalAllowanceForYear} дн. <span className="text-xs font-normal text-blue-600">({quotaValue} + {carryOverValue})</span>
                                </strong>
                            </div>

                            {/* Reason / note */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                                    Примечание / Основание
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Например: Утверждено на 2027 год с учетом графика"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Сохранение...' : `Сохранить на ${selectedYear} г.`}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* History */}
                    {historyList.length > 0 && (
                        <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> История изменений
                            </h4>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {historyList.map((entry: any, idx: number) => (
                                    <div key={entry.id || idx} className="text-xs bg-gray-50 border border-gray-100 p-2.5 rounded-lg flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-800">
                                                {entry.year ? `${entry.year} г.: ` : ''}{entry.note || 'Корректировка'}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                {entry.date} • {entry.addedBy || 'Администратор'}
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            {entry.quota !== undefined && (
                                                <div className="font-bold text-gray-700">Квота: {entry.quota} дн.</div>
                                            )}
                                            {entry.carryOver !== undefined && (
                                                <div className="font-semibold text-emerald-600">Остаток: +{entry.carryOver} дн.</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
