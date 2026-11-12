import React, { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Send, ClipboardList, Trash2, UserCheck, Mail, Users, AlertCircle, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { countBillableDays, countBillableDaysForYear, calculateUserVacationStatsForYear, getApproverForUser, parseDateLocalObj, parseDateLocal } from '../lib/utils';
import { BalanceCard } from './BalanceCard';
import { PersonalYearCalendar } from './PersonalYearCalendar';
import { TeamCalendar } from './TeamCalendar';
import { ConfirmModal } from './ConfirmModal';
import { generateVacationDocument } from '../lib/documentGenerator';

export const UserView = ({ onAdd, onUpdate, onDel, calendarProps }: any) => {
    const { currentUser: user, users, vacations: vacs, holidays, emailTemplates } = useAppContext();
    const [sel, setSel] = useState({ start: null as Date | null, end: null as Date | null, count: 0 }), [replacementId, setReplacementId] = useState(''), [isSendingDrafts, setIsSendingDrafts] = useState(false);
    const [errorModal, setErrorModal] = useState<string | null>(null);
    const [downloadPopup, setDownloadPopup] = useState<{msg: string, y: number} | null>(null);

    useEffect(() => {
        if (errorModal || isSendingDrafts) {
            if ('parentIFrame' in window && (window as any).parentIFrame) {
                (window as any).parentIFrame.scrollToOffset(0, 0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [errorModal, isSendingDrafts]);

    const calendarYear = calendarProps.currentMonthDate.getFullYear();
    const activeYearStats = calculateUserVacationStatsForYear(user, vacs, holidays, calendarYear);

    // Only show requests for the selected calendar year
    const yearVacs = useMemo(() => {
        return vacs.filter((v: any) => {
            if (v.userId !== user.id) return false;
            const startYear = parseDateLocalObj(v.startDate).getFullYear();
            const endYear = parseDateLocalObj(v.endDate).getFullYear();
            return startYear === calendarYear || endYear === calendarYear;
        }).sort((a: any, b: any) => parseDateLocal(a.startDate) - parseDateLocal(b.startDate));
    }, [vacs, user.id, calendarYear]);

    const draftCount = yearVacs.filter((v: any) => v.status === 'draft').length;

    const potentialReplacements = useMemo(() => {
        if (user.role === 'ceo') return users.filter((u: any) => u.id !== user.id && u.role === 'manager');
        return users.filter((u: any) => u.department === user.department && u.id !== user.id);
    }, [users, user]);

    const handleSelect = (date: Date) => { if (!sel.start || (sel.start && sel.end)) setSel({ start: date, end: null, count: 0 }); else { let s = sel.start, e = date; if (date < s) { s = date; e = sel.start; } setSel({ start: s, end: e, count: countBillableDays(s, e, holidays) }); } };

    const handleAction = async (status: string) => {
        if (!sel.start || !sel.end) return;
        const sYear = sel.start.getFullYear();
        const eYear = sel.end.getFullYear();

        if (sYear === eYear) {
            const stats = calculateUserVacationStatsForYear(user, vacs, holidays, sYear);
            if (sel.count > stats.availableWithoutDrafts) {
                setErrorModal(`Недостаточно дней отпуска на ${sYear} год. Выбрано ${sel.count} дн., а доступно ${Math.max(0, stats.availableWithoutDrafts)} дн. (с учетом квоты и остатков прошлых лет).`);
                return;
            }
        } else {
            const daysY1 = countBillableDaysForYear(sel.start, sel.end, sYear, holidays);
            const daysY2 = countBillableDaysForYear(sel.start, sel.end, eYear, holidays);
            const stats1 = calculateUserVacationStatsForYear(user, vacs, holidays, sYear);
            const stats2 = calculateUserVacationStatsForYear(user, vacs, holidays, eYear);

            if (daysY1 > stats1.availableWithoutDrafts) {
                setErrorModal(`Недостаточно дней отпуска на ${sYear} год. На ${sYear} приходится ${daysY1} дн., а доступно ${Math.max(0, stats1.availableWithoutDrafts)} дн.`);
                return;
            }
            if (daysY2 > stats2.availableWithoutDrafts) {
                setErrorModal(`Недостаточно дней отпуска на ${eYear} год. На ${eYear} приходится ${daysY2} дн., а доступно ${Math.max(0, stats2.availableWithoutDrafts)} дн.`);
                return;
            }
        }

        let finalStatus = status; if (status === 'pending' && (user.role === 'admin' || user.role === 'ceo')) finalStatus = 'approved';
        try {
            await onAdd({ userId: user.id, startDate: sel.start.toLocaleDateString('en-CA'), endDate: sel.end.toLocaleDateString('en-CA'), status: finalStatus, replacementId: replacementId ? Number(replacementId) : null });
            setSel({ start: null, end: null, count: 0 }); setReplacementId('');
        } catch (e) { console.error(e); alert('Произошла ошибка при сохранении заявки.'); }
    };

    const sendAllDrafts = () => {
        const drafts = yearVacs.filter((v: any) => v.status === 'draft'); 
        if (!drafts.length) return;

        const nonDraftVacs = vacs.filter((v: any) => v.userId === user.id && v.status !== 'draft');
        const draftDaysInYear = drafts.reduce((sum: number, d: any) => sum + countBillableDaysForYear(d.startDate, d.endDate, calendarYear, holidays), 0);
        const stats = calculateUserVacationStatsForYear(user, nonDraftVacs, holidays, calendarYear);
        if (draftDaysInYear > stats.availableWithoutDrafts) {
            setErrorModal(`Недостаточно дней отпуска на ${calendarYear} год. В черновиках ${draftDaysInYear} дн., а доступно ${Math.max(0, stats.availableWithoutDrafts)} дн.`);
            return;
        }

        setIsSendingDrafts(true);
    };

    const confirmSend = async () => {
        const drafts = yearVacs.filter((v: any) => v.status === 'draft'), finalStatus = (user.role === 'admin' || user.role === 'ceo') ? 'approved' : 'pending';
        try {
            await Promise.all(drafts.map((d: any) => onUpdate({ ...d, status: finalStatus })));
        } catch (e) { console.error(e); alert('Произошла ошибка при отправке заявок.'); }
        setIsSendingDrafts(false);
    };

    const myApprover = getApproverForUser(user, users);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-6">
                <BalanceCard 
                    year={calendarYear} 
                    onYearChange={(newYear: number) => {
                        if (newYear > calendarYear) calendarProps.onNextYear();
                        else if (newYear < calendarYear) calendarProps.onPrevYear();
                    }} 
                />
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600"/>Параметры новой заявки</h3>
                    <div className="mb-4 text-sm text-gray-600">{sel.start && sel.end ? (<div><span className="block font-medium">Даты:</span> {sel.start.toLocaleDateString()} — {sel.end.toLocaleDateString()} <span className="ml-2 font-bold text-blue-600">({sel.count} дн.)</span></div>) : (<span className="italic text-gray-400">Выберите даты на календаре...</span>)}</div>
                    <div className="mb-4"><label className="block text-xs font-medium text-gray-500 mb-1">Заместитель</label><div className="relative"><select value={replacementId} onChange={(e) => setReplacementId(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 appearance-none bg-white text-sm"><option value="">Не выбран</option>{potentialReplacements.map((u: any) => (<option key={u._docId || u.id} value={u.id}>{u.name}</option>))}</select><UserCheck className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" /></div></div>
                    <div className="flex flex-col gap-2">
                         <button onClick={() => handleAction('draft')} disabled={!sel.start || !sel.end} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><FileText className="w-4 h-4"/> Сохранить черновик</button>
                         <button onClick={() => handleAction('pending')} disabled={!sel.start || !sel.end} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><Send className="w-4 h-4"/> На согласование</button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex-grow">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-gray-800 flex items-center gap-2">
                             <ClipboardList className="w-5 h-5 text-gray-500"/>
                             Заявки ({calendarYear} г.)
                         </h3>
                         {draftCount > 0 && (
                             <button onClick={sendAllDrafts} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded text-xs hover:bg-blue-100 font-medium transition-colors">
                                 <Send className="w-3 h-3"/> Отправить все ({draftCount})
                             </button>
                         )}
                     </div>
                    <div className="space-y-2">
                        {yearVacs.length === 0 && <p className="text-sm text-gray-400 italic">Пока нет запланированных отпусков на {calendarYear} год</p>}
                        {yearVacs.map((v: any)=>(
                            <div key={v._docId || v.id} className="flex justify-between items-start text-sm border-b border-gray-100 pb-3 last:border-0 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                <div>
                                    <div className="font-medium text-gray-800">{new Date(v.startDate).toLocaleDateString()} — {new Date(v.endDate).toLocaleDateString()}</div>
                                    <div className="text-xs text-gray-500 mt-1">{countBillableDays(v.startDate, v.endDate, holidays)} дн.</div>
                                    <div className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${v.status==='approved'?'bg-green-100 text-green-700': v.status==='rejected'?'bg-red-100 text-red-700': v.status==='draft'?'bg-gray-100 text-gray-700 border border-gray-200': 'bg-amber-100 text-amber-700'}`}>
                                        {v.status === 'pending' ? 'На согласовании' : v.status === 'approved' ? 'Согласовано' : v.status === 'draft' ? 'Черновик' : 'Отклонено'}
                                    </div>
                                    {v.replacementId && <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><UserCheck className="w-3 h-3"/> Зам: {users.find((u: any)=>u.id===v.replacementId)?.name}</div>}
                                </div>
                                <div className="flex gap-1">
                                    {v.status === 'approved' && (
                                        <button onClick={async (e) => {
                                            const yPos = e.pageY;
                                            await generateVacationDocument(user, v.startDate, v.endDate, countBillableDays(v.startDate, v.endDate, holidays));
                                            let msg = emailTemplates?.downloadPopupMessage || '{{name}}, распечатай скачанное заявление, подпиши и отправь скан на почту buh@test.ru';
                                            msg = msg.replace(/{{name}}/g, user.name);
                                            setDownloadPopup({ msg, y: yPos });
                                        }} className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded transition-colors" title="Скачать заявление"><Download className="w-4 h-4"/></button>
                                    )}
                                    <button onClick={()=>onDel(v.id)} className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors" title="Удалить"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="md:col-span-2 space-y-8">
                 <PersonalYearCalendar year={calendarProps.currentMonthDate.getFullYear()} onSelectRange={handleSelect} selection={sel} balance={activeYearStats.remainingDays} onPrevYear={() => calendarProps.onPrevYear()} onNextYear={() => calendarProps.onNextYear()} />
                 <div className="mt-8"><h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Users className="w-6 h-6"/> График отдела</h2><TeamCalendar localDraft={sel} {...calendarProps} /></div>
            </div>
            <ConfirmModal isOpen={isSendingDrafts} title="Отправка черновиков" message={draftCount === 1 ? `Отправить черновик на ${calendarYear} год на согласование?` : `Отправить все черновики (${draftCount}) на ${calendarYear} год на согласование?`} confirmText="Отправить" isDanger={false} onConfirm={confirmSend} onCancel={() => setIsSendingDrafts(false)} />
            {errorModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-200 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <h4 className="font-bold text-gray-800 text-lg mb-2">Ошибка отправки</h4>
                        <p className="text-sm text-gray-600 mb-6">{errorModal}</p>
                        <button onClick={() => setErrorModal(null)} className="w-full py-2 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors">
                            Понятно
                        </button>
                    </div>
                </div>
            )}
            {downloadPopup && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-fadeIn"></div>
                    <div className="absolute z-50 bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-200 text-center transform -translate-x-1/2 -translate-y-1/2 animate-fadeIn" style={{ top: `${downloadPopup.y}px`, left: '50%' }}>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <h4 className="font-bold text-gray-800 text-lg mb-2">Заявление скачано</h4>
                        <p className="text-sm text-gray-600 mb-6">{downloadPopup.msg}</p>
                        <button onClick={() => setDownloadPopup(null)} className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                            Понятно
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
