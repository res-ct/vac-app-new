import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { isWeekend, parseDateLocal, isSameDay, parseDateLocalObj } from '../lib/utils';
import { FULL_MONTHS, WEEKDAYS } from '../lib/constants';

export const PersonalYearCalendar = ({ year, onSelectRange, selection, onPrevYear, onNextYear }: any) => {
    const { currentUser: user, vacations, users, holidays } = useAppContext();
    const [tooltip, setTooltip] = useState<any>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>(user.id.toString());

    const subordinates = (user.role === 'ceo' 
        ? users.filter((u: any) => u.id !== user.id)
        : users.filter((u: any) => u.department === user.department && u.id !== user.id)).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    const allTeamMembers = [user, ...subordinates];
    const targetUserId = selectedUserId;
    const teamIds = selectedUserId === user.id.toString() 
        ? allTeamMembers.filter(u => u.id.toString() !== targetUserId).map(u => u.id)
        : [];
    const today = new Date();

    const renderMonth = (monthIndex: number) => {
        const date = new Date(year, monthIndex, 1), daysInMonth = new Date(year, monthIndex + 1, 0).getDate(), startDay = (date.getDay() + 6) % 7, days = [];

        for (let i = 0; i < startDay; i++) days.push(<div key={`e-${i}`} className="w-8 h-8"></div>);
        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(year, monthIndex, d), currentMs = current.getTime(), isWe = isWeekend(current, holidays), isToday = isSameDay(current, today);
            const vac = vacations.find((v: any) => v.userId.toString() === targetUserId && currentMs >= parseDateLocal(v.startDate) && currentMs <= parseDateLocal(v.endDate) && v.status !== 'rejected');
            const teamVacs = vacations.filter((v: any) => teamIds.includes(v.userId) && currentMs >= parseDateLocal(v.startDate) && currentMs <= parseDateLocal(v.endDate) && v.status !== 'rejected');
            
            let bgClass = isWe ? "text-red-500" : "text-gray-700", cellClass = "hover:bg-gray-100 cursor-pointer relative", indicator = null;

            if (vac) { if (vac.status === 'approved') { bgClass = "bg-blue-600 text-white"; cellClass = ""; } else if (vac.status === 'pending') { bgClass = "bg-amber-400 text-white"; cellClass = ""; } else if (vac.status === 'draft') { bgClass = "bg-gray-400 text-white"; cellClass = "cursor-pointer hover:bg-gray-500"; } } 
            else if (teamVacs.length > 0) { if (teamVacs.some((v: any) => v.status === 'approved')) bgClass = "bg-cyan-100 text-cyan-900"; else if (teamVacs.some((v: any) => v.status === 'pending')) bgClass = "bg-orange-100 text-orange-900"; else bgClass = "bg-gray-100 text-gray-500 border border-dashed border-gray-300"; }
            
            if (isToday && !vac && teamVacs.length === 0) {
                bgClass = isWe ? "text-red-600 font-bold bg-blue-50/50" : "text-blue-700 font-bold bg-blue-50/50";
                cellClass = "cursor-pointer hover:bg-blue-100 relative";
            }
            
            if (selection.start && current.getTime() === selection.start.getTime()) bgClass = "bg-indigo-600 text-white rounded-l-full";
            if (selection.end && current.getTime() === selection.end.getTime()) bgClass = "bg-indigo-600 text-white rounded-r-full";
            if (selection.start && selection.end && current > selection.start && current < selection.end) bgClass = "bg-indigo-200 text-indigo-800";
            if ((vac || (selection.start && current >= selection.start && current <= (selection.end || selection.start))) && teamVacs.length > 0) indicator = <div className="absolute bottom-0.5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-sm"></div>;
            
            let todayRing = isToday ? "ring-2 ring-blue-400 ring-offset-1 font-bold z-10" : "";

            const buildTooltip = () => { 
                let lines: string[] = []; 
                if (vac) {
                    const targetUser = allTeamMembers.find(u => u.id.toString() === targetUserId);
                    const nameLabel = targetUserId === user.id.toString() ? 'Я' : targetUser?.name;
                    const ds = parseDateLocalObj(vac.startDate).toLocaleDateString('ru-RU');
                    const de = parseDateLocalObj(vac.endDate).toLocaleDateString('ru-RU');
                    lines.push(`${nameLabel}: ${vac.status === 'approved' ? 'Согласовано' : vac.status === 'pending' ? 'На согласовании' : 'Черновик'} (${ds} - ${de})`); 
                }
                if (teamVacs.length > 0) { 
                    if (vac) lines.push('---'); 
                    teamVacs.forEach((v: any) => { 
                        const u = users.find((u: any) => u.id === v.userId); 
                        if (u) {
                            const ds = parseDateLocalObj(v.startDate).toLocaleDateString('ru-RU');
                            const de = parseDateLocalObj(v.endDate).toLocaleDateString('ru-RU');
                            lines.push(`${u.name}: ${v.status === 'approved' ? 'Согласовано' : v.status === 'pending' ? 'Ждет' : 'Черновик'} (${ds} - ${de})`); 
                        }
                    }); 
                } 
                return lines.length > 0 ? lines.join('\n') : null; 
            };

            days.push(<div key={`d-${monthIndex}-${d}`} onClick={() => onSelectRange(current)} onMouseEnter={(e: any) => { const tt = buildTooltip(); if (tt) { const rect = e.target.getBoundingClientRect(); setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 5, text: tt }); } }} onMouseLeave={() => setTooltip(null)} className={`w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors relative ${bgClass} ${cellClass} ${todayRing}`}>{d}{indicator}</div>);
        }
        return <div key={`m-${monthIndex}`} className="mb-6"><h4 className="font-bold text-gray-800 mb-2 pl-2">{FULL_MONTHS[monthIndex]}</h4><div className="grid grid-cols-7 gap-1 text-center">{WEEKDAYS.map(w => <div key={`wd-${w}`} className="text-xs text-gray-400 font-medium w-8">{w}</div>)}{days}</div></div>;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
            {tooltip && (<div className="fixed z-50 bg-gray-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none whitespace-pre-line" style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}>{tooltip.text}</div>)}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onPrevYear} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-5 h-5"/></button>
                    <span className="text-xl font-bold text-gray-900">{year}</span>
                    <button onClick={onNextYear} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight className="w-5 h-5"/></button>
                    
                    {(user.role === 'manager' || user.role === 'ceo') && subordinates.length > 0 && (
                        <select 
                            value={selectedUserId} 
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="ml-4 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value={user.id.toString()}>Мой календарь</option>
                            <optgroup label="Сотрудники">
                                {subordinates.map((u: any) => (
                                    <option key={u.id} value={u.id.toString()}>{u.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-500 mr-4">Выбрано: <span className="font-bold text-indigo-600">{selection.count}</span> дн.</div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">{Array.from({length: 12}, (_, i) => renderMonth(i))}</div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div>{selectedUserId === user.id.toString() ? 'Ваш' : 'Сотрудник'} (Одобрен)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div>{selectedUserId === user.id.toString() ? 'Ваш' : 'Сотрудник'} (Ждет)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400"></div>{selectedUserId === user.id.toString() ? 'Ваш' : 'Сотрудник'} (Черновик)</div>
                {selectedUserId === user.id.toString() && (
                    <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-100 border border-cyan-200"></div>Коллега (Одобрен)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-100 border border-orange-200"></div>Коллега (Ждет)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-dashed border-gray-400 bg-gray-50"></div>Коллега (Черновик)</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div>Пересечение</div>
                    </>
                )}
            </div>
        </div>
    );
};
