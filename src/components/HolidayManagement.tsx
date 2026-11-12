import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, X, Plus, Sparkles, Trash2, ChevronLeft, ChevronRight, AlertCircle, Check, Info } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { CURRENT_YEAR, DEFAULT_HOLIDAYS } from '../lib/constants';
import { STANDARD_HOLIDAY_DATES } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';
import { setDoc, doc } from 'firebase/firestore';
import { db, appId } from '../firebase';

export const HolidayManagement = () => {
    const { holidays, logAction } = useAppContext();
    const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
    const [inputText, setInputText] = useState('');
    const [parsed, setParsed] = useState<string[]>([]);
    const [holidayToDelete, setHolidayToDelete] = useState<string | null>(null);
    const [confirmClearYear, setConfirmClearYear] = useState(false);
    const [singleDate, setSingleDate] = useState(`${CURRENT_YEAR}-01-01`);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    // Sync singleDate input year with selectedYear
    useEffect(() => {
        setSingleDate(`${selectedYear}-01-01`);
    }, [selectedYear]);

    useEffect(() => {
        if (holidayToDelete || confirmClearYear) {
            if ('parentIFrame' in window && (window as any).parentIFrame) {
                (window as any).parentIFrame.scrollToOffset(0, 0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [holidayToDelete, confirmClearYear]);

    // Current holidays specifically for the selected year from Firestore (or fallback default)
    const currentYearHolidays: string[] = useMemo(() => {
        if (holidays && holidays[selectedYear] !== undefined) {
            return Array.isArray(holidays[selectedYear]) ? holidays[selectedYear] : [];
        }
        if (DEFAULT_HOLIDAYS[selectedYear]) {
            return DEFAULT_HOLIDAYS[selectedYear];
        }
        return STANDARD_HOLIDAY_DATES;
    }, [holidays, selectedYear]);

    // Chronologically sorted holidays
    const sortedHolidays = useMemo(() => {
        return [...currentYearHolidays].sort((a, b) => {
            const [d1, m1] = a.split('-').map(Number);
            const [d2, m2] = b.split('-').map(Number);
            if (m1 !== m2) return m1 - m2;
            return d1 - d2;
        });
    }, [currentYearHolidays]);

    const formatHolidayTitle = (dateStr: string, year: number) => {
        const [d, m] = dateStr.split('-').map(Number);
        const dateObj = new Date(year, (m || 1) - 1, d || 1);
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const weekdayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        const monthName = monthNames[(m || 1) - 1] || '';
        const weekday = weekdayNames[dateObj.getDay()] || '';
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

        return {
            formatted: `${d} ${monthName}`,
            weekday: weekday.toUpperCase(),
            isWeekend
        };
    };

    const parseHolidays = (text: string) => {
        const monthMap: Record<string, string> = { 
            января: '01', февраля: '02', марта: '03', апреля: '04', 
            мая: '05', июня: '06', июля: '07', августа: '08', 
            сентября: '09', октября: '10', ноября: '11', декабря: '12' 
        };
        const holidaysSet = new Set<string>();
        const textRegex = /((?:\d{1,2}[,\sи]*)+)(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi;
        let match;
        while ((match = textRegex.exec(text)) !== null) {
            const daysStr = match[1];
            const monthStr = match[2].toLowerCase();
            const monthNum = monthMap[monthStr];
            const days = daysStr.match(/\d{1,2}/g);
            if (days && monthNum) {
                days.forEach((d: string) => holidaysSet.add(`${String(d).padStart(2, '0')}-${monthNum}`));
            }
        }
        const numRegex = /\b(\d{1,2})[./-](\d{1,2})\b/g;
        while ((match = numRegex.exec(text)) !== null) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                holidaysSet.add(`${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`);
            }
        }
        setParsed(Array.from(holidaysSet).sort());
    };

    const showSuccess = (msg: string) => {
        setSaveSuccess(msg);
        setTimeout(() => setSaveSuccess(null), 3000);
    };

    // Save batch parsed dates
    const handleSaveParsed = async () => {
        if (parsed.length === 0) return;
        setIsSaving(true);
        try {
            const combined = Array.from(new Set([...currentYearHolidays, ...parsed])).sort();
            await setDoc(
                doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
                { [selectedYear]: combined }, 
                { merge: true }
            );
            logAction(
                'ADD_HOLIDAYS', 
                `Добавлены праздничные дни на ${selectedYear} год: ${parsed.join(', ')}`
            );
            showSuccess(`Добавлено ${parsed.length} дн. на ${selectedYear} год!`);
            setInputText('');
            setParsed([]);
        } catch (err) {
            console.error('Error adding holidays:', err);
            alert('Ошибка при сохранении дат.');
        } finally {
            setIsSaving(false);
        }
    };

    // Add a single specific date from the date input
    const handleAddSingleDate = async () => {
        if (!singleDate) return;
        const [y, m, d] = singleDate.split('-').map(Number);
        const dateKey = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
        
        if (currentYearHolidays.includes(dateKey)) {
            alert(`Дата ${d}.${m} уже есть в списке праздников на ${selectedYear} год.`);
            return;
        }

        setIsSaving(true);
        try {
            const combined = Array.from(new Set([...currentYearHolidays, dateKey])).sort();
            await setDoc(
                doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
                { [selectedYear]: combined }, 
                { merge: true }
            );
            logAction(
                'ADD_HOLIDAY_SINGLE', 
                `Добавлен праздник ${dateKey} на ${selectedYear} год`
            );
            const info = formatHolidayTitle(dateKey, selectedYear);
            showSuccess(`Дата ${info.formatted} добавлена в ${selectedYear} год!`);
        } catch (err) {
            console.error('Error adding single holiday:', err);
            alert('Ошибка при сохранении даты.');
        } finally {
            setIsSaving(false);
        }
    };

    // Fill with Standard Russian National Holidays
    const handleFillStandardHolidays = async () => {
        setIsSaving(true);
        try {
            const combined = Array.from(new Set([...currentYearHolidays, ...STANDARD_HOLIDAY_DATES])).sort();
            await setDoc(
                doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
                { [selectedYear]: combined }, 
                { merge: true }
            );
            logAction(
                'FILL_STANDARD_HOLIDAYS', 
                `Заполнены стандартные праздники РФ на ${selectedYear} год`
            );
            showSuccess(`Стандартные государственные праздники РФ добавлены на ${selectedYear} год!`);
        } catch (err) {
            console.error('Error filling standard holidays:', err);
            alert('Ошибка при заполнении стандартных праздников.');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete single holiday
    const confirmDeleteHoliday = async () => {
        if (!holidayToDelete) return;
        setIsSaving(true);
        try {
            const updated = currentYearHolidays.filter(d => d !== holidayToDelete);
            await setDoc(
                doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
                { [selectedYear]: updated }, 
                { merge: true }
            );
            logAction(
                'DELETE_HOLIDAY', 
                `Удален праздничный день ${holidayToDelete} из производственного календаря на ${selectedYear} год`
            );
            const info = formatHolidayTitle(holidayToDelete, selectedYear);
            showSuccess(`Дата ${info.formatted} удалена из ${selectedYear} года`);
            setHolidayToDelete(null);
        } catch (err) {
            console.error('Error deleting holiday:', err);
            alert('Произошла ошибка при удалении даты.');
        } finally {
            setIsSaving(false);
        }
    };

    // Clear all holidays for the selected year
    const handleClearYear = async () => {
        setIsSaving(true);
        try {
            await setDoc(
                doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
                { [selectedYear]: [] }, 
                { merge: true }
            );
            logAction(
                'CLEAR_YEAR_HOLIDAYS', 
                `Очищены все праздничные дни на ${selectedYear} год`
            );
            showSuccess(`Все праздничные дни ${selectedYear} года очищены`);
            setConfirmClearYear(false);
        } catch (err) {
            console.error('Error clearing holidays:', err);
            alert('Произошла ошибка при очистке календаря.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
            {/* Header with Year Selector */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                <div>
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Производственный календарь: праздничные дни
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Праздники и переносы выходных дней настраиваются индивидуально для каждого года
                    </p>
                </div>

                {/* Year Switcher */}
                <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl shadow-2xs">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                        Год:
                    </span>
                    <div className="flex items-center gap-1 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setSelectedYear(y => y - 1)}
                            className="p-1 hover:bg-indigo-50 rounded text-indigo-700 transition-colors"
                            title="Предыдущий год"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-base font-bold text-indigo-950 px-2 min-w-[3.5rem] text-center">
                            {selectedYear}
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
            </div>

            {/* Quick Year Navigation Pills */}
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 text-xs">
                <span className="text-gray-400 font-medium mr-1">Быстрый переход:</span>
                {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map((y) => (
                    <button
                        key={y}
                        type="button"
                        onClick={() => setSelectedYear(y)}
                        className={`px-3 py-1 rounded-lg font-medium transition-all ${
                            selectedYear === y 
                                ? 'bg-indigo-600 text-white shadow-2xs' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                    >
                        {y} год
                    </button>
                ))}
            </div>

            {saveSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {saveSuccess}
                </div>
            )}

            {/* Grid for Adding Holidays */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Method 1: Single Date Picker */}
                <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-indigo-600" />
                            Добавить отдельную дату
                        </h4>
                        <p className="text-[11px] text-gray-500 mb-3">
                            Выберите конкретный нерабочий праздничный день или перенос для {selectedYear} года:
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={singleDate}
                                min={`${selectedYear}-01-01`}
                                max={`${selectedYear}-12-31`}
                                onChange={(e) => setSingleDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 flex-1 font-medium text-gray-800"
                            />
                            <button
                                type="button"
                                onClick={handleAddSingleDate}
                                disabled={isSaving || !singleDate}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                            >
                                <Plus className="w-3.5 h-3.5" /> Добавить в {selectedYear} г.
                            </button>
                        </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-200/60 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">
                            Быстрое заполнение:
                        </span>
                        <button
                            type="button"
                            onClick={handleFillStandardHolidays}
                            disabled={isSaving}
                            className="text-xs text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:bg-indigo-50 font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 shadow-2xs"
                            title="Добавить все 14 стандартных государственных праздников РФ"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Заполнить стандартными праздниками РФ
                        </button>
                    </div>
                </div>

                {/* Method 2: Batch Text Decree Parser */}
                <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Вставка текста постановления / дат списком
                        </h4>
                        <p className="text-[11px] text-gray-500 mb-2">
                            Вставьте текст из Консультанта (напр. <i>«1, 2 и 8 января, 23 февраля...»</i>) или даты (<i>02.05, 31.12</i>):
                        </p>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none bg-white"
                            value={inputText}
                            onChange={(e) => {
                                setInputText(e.target.value);
                                parseHolidays(e.target.value);
                            }}
                            placeholder="Вставьте официальный текст или список дат..."
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-600 truncate">
                            {parsed.length > 0 ? (
                                <span className="font-semibold text-indigo-700">
                                    Распознано: {parsed.length} дн.
                                </span>
                            ) : (
                                <span className="text-gray-400">Дни не распознаны</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveParsed}
                            disabled={parsed.length === 0 || isSaving}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex-shrink-0"
                        >
                            Добавить {parsed.length > 0 ? `(${parsed.length} дн.)` : ''} в {selectedYear} г.
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview of Parsed Dates */}
            {parsed.length > 0 && (
                <div className="mb-6 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs">
                    <span className="font-bold text-indigo-950 block mb-1.5">
                        Будут добавлены в календарь {selectedYear} года ({parsed.length} дн.):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {parsed.map(d => {
                            const info = formatHolidayTitle(d, selectedYear);
                            return (
                                <span key={`p-${d}`} className="bg-white text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] font-medium shadow-2xs">
                                    {info.formatted} <span className="text-indigo-400 font-normal">({d})</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Existing Holidays for selectedYear */}
            <div className="pt-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-sm">
                            Праздники в {selectedYear} году
                        </h4>
                        <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full text-xs">
                            {sortedHolidays.length} дн.
                        </span>
                    </div>
                    {sortedHolidays.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setConfirmClearYear(true)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Очистить все дни {selectedYear} года
                        </button>
                    )}
                </div>

                {sortedHolidays.length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                        <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        Для {selectedYear} года еще не заданы праздничные дни.
                        <div className="mt-2">
                            <button
                                type="button"
                                onClick={handleFillStandardHolidays}
                                className="text-xs text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Заполнить стандартными праздниками РФ
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {sortedHolidays.map((d: string) => {
                            const info = formatHolidayTitle(d, selectedYear);
                            return (
                                <div
                                    key={`h-${d}`}
                                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors group"
                                >
                                    <div className="min-w-0 pr-1">
                                        <div className="font-semibold text-xs text-gray-800 leading-tight truncate" title={info.formatted}>
                                            {info.formatted}
                                        </div>
                                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                            <span>{d}</span>
                                            <span>•</span>
                                            <span className={`font-semibold ${info.isWeekend ? 'text-red-500' : 'text-gray-600'}`}>
                                                {info.weekday}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHolidayToDelete(d)}
                                        className="text-gray-300 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                        title={`Удалить ${info.formatted}`}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Confirmation Modal for Deleting Single Holiday */}
            <ConfirmModal
                isOpen={!!holidayToDelete}
                title="Удаление праздничного дня"
                message={holidayToDelete ? `Вы уверены, что хотите удалить ${formatHolidayTitle(holidayToDelete, selectedYear).formatted} (${holidayToDelete}) из производственного календаря на ${selectedYear} год?` : ''}
                confirmText="Удалить"
                isDanger={true}
                onConfirm={confirmDeleteHoliday}
                onCancel={() => setHolidayToDelete(null)}
            />

            {/* Confirmation Modal for Clearing Year */}
            <ConfirmModal
                isOpen={confirmClearYear}
                title={`Очистка календаря на ${selectedYear} год`}
                message={`ВНИМАНИЕ! Это действие удалит ВСЕ праздничные дни (${sortedHolidays.length} дн.) из производственного календаря на ${selectedYear} год. Продолжить?`}
                confirmText="Очистить всё"
                isDanger={true}
                onConfirm={handleClearYear}
                onCancel={() => setConfirmClearYear(false)}
            />
        </div>
    );
};
