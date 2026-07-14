import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { isWeekend, isSameDay, parseDateLocal, parseDateLocalObj } from '../lib/utils';
import { MONTHS_SHORT, FULL_MONTHS } from '../lib/constants';

export const TeamCalendar = ({ currentMonthDate, onPrev, onNext, viewMode, setViewMode, localDraft }: any) => {
    const { vacations, users, departments, currentUser, holidays } = useAppContext();
    const year = currentMonthDate.getFullYear(), month = currentMonthDate.getMonth(), today = new Date();
    const months = viewMode === 'year' ? MONTHS_SHORT.map((_, i) => i) : viewMode === 'quarter' ? [Math.floor(month/3)*3, Math.floor(month/3)*3+1, Math.floor(month/3)*3+2] : [month];
    const [expandedDepts, setExpandedDepts] = useState<string[]>([]), [ceoFilter, setCeoFilter] = useState('direct');
    const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

    useEffect(() => { 
        if (currentUser.role === 'admin' || currentUser.role === 'ceo') setExpandedDepts(departments); 
        else setExpandedDepts([currentUser.department]); 
    }, [currentUser, departments]);

    const toggleDept = (dept: string) => { if (expandedDepts.includes(dept)) setExpandedDepts(expandedDepts.filter(d => d !== dept)); else setExpandedDepts([...expandedDepts, dept]); };
    const getVacationForDay = (uid: number, d: number) => vacations.find((v: any) => v.userId === uid && d >= parseDateLocal(v.startDate) && d <= parseDateLocal(v.endDate));
    const isLocalDraftDay = (d: number) => { if (!localDraft || !localDraft.start || !localDraft.end) return false; return d >= parseDateLocal(localDraft.start) && d <= parseDateLocal(localDraft.end); };

    const usersByDept = useMemo(() => {
        const grouped: any = {}; departments.forEach((d: string) => grouped[d] = []);
        users.filter((u: any) => u.role !== 'admin').forEach((u: any) => { 
            if (currentUser.role === 'ceo' && ceoFilter === 'direct') { const isManager = u.role === 'manager', isOrphan = u.role === 'employee' && !users.some((other: any) => other.department === u.department && other.role === 'manager'); if (!isManager && !isOrphan) return; }
            if(grouped[u.department]) grouped[u.department].push(u); 
        });
        if (currentUser.role !== 'admin' && currentUser.role !== 'ceo') { const myDept = currentUser.department; if (grouped[myDept]) grouped[myDept].sort((a: any, b: any) => a.id === currentUser.id ? -1 : b.id === currentUser.id ? 1 : 0); }
        return grouped;
    }, [users, departments, currentUser, ceoFilter]);

    const getHeaderText = () => {
        if (viewMode === 'year') return year;
        if (viewMode === 'quarter') {
            const qStart = FULL_MONTHS[Math.floor(month / 3) * 3];
            const qEnd = FULL_MONTHS[Math.floor(month / 3) * 3 + 2];
            const formatMonth = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
            return `${formatMonth(qStart)} - ${formatMonth(qEnd)} (${Math.floor(month / 3) + 1}/${year})`;
        }
        const mStr = FULL_MONTHS[month];
        return `${mStr.charAt(0).toUpperCase() + mStr.slice(1).toLowerCase()} ${year}`;
    };

    const visibleDepartments = selectedDeptFilter === 'all' ? departments : [selectedDeptFilter];

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky left-0 z-20 flex-wrap gap-4">
                <div className="font-bold text-gray-800 flex gap-2 text-lg items-center"><Calendar className="w-6 h-6 text-blue-600"/> {getHeaderText()}</div>
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
                        <span className="text-xs text-gray-500 font-medium">Отдел:</span>
                        <select value={selectedDeptFilter} onChange={(e) => { setSelectedDeptFilter(e.target.value); if (e.target.value !== 'all' && !expandedDepts.includes(e.target.value)) setExpandedDepts([...expandedDepts, e.target.value]); }} className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer">
                            <option value="all">Все отделы</option>
                            {departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    {currentUser.role === 'ceo' && (<div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={()=>setCeoFilter('direct')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ceoFilter==='direct'?'bg-white text-purple-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Мои подчиненные</button><button onClick={()=>setCeoFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${ceoFilter==='all'?'bg-white text-purple-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Все сотрудники</button></div>)}
                    <div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={()=>setViewMode('month')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode==='month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Месяц</button><button onClick={()=>setViewMode('quarter')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode==='quarter'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Квартал</button><button onClick={()=>setViewMode('year')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode==='year'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>Год</button></div>
                    <div className="flex gap-1"><button onClick={onPrev} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft className="w-5 h-5"/></button><button onClick={onNext} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight className="w-5 h-5"/></button></div>
                </div>
            </div>
            <div className="overflow-x-auto relative">
                <div className="min-w-[800px]">
                    <div className="flex border-b border-gray-200 bg-gray-50/50">
                        <div className="w-64 flex-shrink-0 p-3 border-r border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">Сотрудник</div>
                        <div className="flex-grow flex">
                            {months.map(mIdx => {
                                const daysInMonth = new Date(year, mIdx+1, 0).getDate();
                                return viewMode === 'year' ? <div key={`mhdr-${mIdx}`} className="flex-1 text-center text-xs font-semibold py-3 border-r border-gray-200 text-gray-600">{MONTHS_SHORT[mIdx]}</div> : Array.from({length:daysInMonth},(_,i)=>i+1).map(d => {
                                        const currentDate = new Date(year, mIdx, d), isWe = isWeekend(currentDate, holidays), isToday = isSameDay(currentDate, today);
                                        return (<div key={`dhdr-${mIdx}-${d}`} className={`w-8 flex-shrink-0 flex flex-col items-center justify-center text-[10px] py-2 border-r border-gray-200 min-w-[28px] ${isWe ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-600'} ${isToday ? 'text-blue-600 font-bold bg-blue-100 ring-1 ring-inset ring-blue-300 rounded-sm z-10' : ''}`}>{d}</div>)
                                    });
                            })}
                        </div>
                    </div>
                    {visibleDepartments.map((dept: string, index: number) => {
                        const deptUsers = usersByDept[dept];
                        if (!deptUsers || deptUsers.length === 0) return null;
                        return (<React.Fragment key={`dept-${dept}-${index}`}>
                            <div onClick={()=>toggleDept(dept)} className="bg-gray-100/80 px-4 py-2 text-xs font-bold uppercase cursor-pointer flex items-center gap-2 hover:bg-gray-200/80 border-b border-gray-200 text-gray-700 sticky left-0 z-10">{expandedDepts.includes(dept)?<ChevronDown className="w-3 h-3"/>:<ChevronRight className="w-3 h-3"/>}{dept}</div>
                            {expandedDepts.includes(dept) && deptUsers.map((u: any) => (
                                <div key={u._docId || u.id} className={`flex border-b border-gray-100 h-10 transition-colors ${u.id===currentUser.id?'bg-blue-50/30 hover:bg-blue-50/50':'hover:bg-gray-50'}`}>
                                    <div className={`w-64 flex-shrink-0 px-4 border-r border-gray-200 flex items-center gap-3 text-sm sticky left-0 z-10 ${u.id===currentUser.id?'bg-blue-50/30 backdrop-blur-sm':'bg-white'}`}><div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-xs text-gray-600 border border-gray-200 shadow-sm">{u.avatar}</div><span className={`truncate ${u.id===currentUser.id ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>{u.name}</span></div>
                                    <div className="flex-grow flex">{months.map(mIdx => {
                                        const days = new Date(year, mIdx+1, 0).getDate();
                                        return viewMode === 'year' ? <div key={`cyear-${u.id}-${mIdx}`} className="flex-1 border-r border-gray-200 relative bg-white">{Array.from({length:days},(_,i)=>i+1).map(d=>{
                                            const dt = new Date(year,mIdx,d).getTime(), v = getVacationForDay(u.id, dt);
                                            const isToday = isSameDay(new Date(year, mIdx, d), today);
                                            let res = [];
                                            if (isToday) res.push(<div key={`today-${u.id}-${mIdx}-${d}`} className="absolute inset-y-0 bg-blue-200/60" style={{left:`${(d/days)*100}%`, width: `${100/days}%`}}/>);
                                            if (v && v.status === 'approved') {
                                                const dateStr = `${parseDateLocalObj(v.startDate).toLocaleDateString()} — ${parseDateLocalObj(v.endDate).toLocaleDateString()}`;
                                                res.push(<div key={`v-${u.id}-${mIdx}-${d}`} className="absolute inset-y-1 bg-blue-500 rounded-sm opacity-90" title={`Отпуск: ${dateStr}`} style={{left:`${(d/days)*100}%`, width: `${100/days}%`}}/>);
                                            }
                                            return res;
                                        })}</div> : Array.from({length:days},(_,i)=>i+1).map(d => {
                                            const dt = new Date(year, mIdx, d).getTime(), v = getVacationForDay(u.id, dt), isWe = isWeekend(new Date(year, mIdx, d), holidays), isLocal = u.id === currentUser.id && isLocalDraftDay(dt);
                                            const isToday = isSameDay(new Date(year, mIdx, d), today);
                                            let content = null;
                                            if (isLocal) content = <div className="absolute inset-1 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes-light.png')] bg-indigo-100 border border-indigo-300 rounded-sm animate-pulse" title="Планируется"></div>;
                                            else if (v) { 
                                                const dateStr = `${parseDateLocalObj(v.startDate).toLocaleDateString()} — ${parseDateLocalObj(v.endDate).toLocaleDateString()}`;
                                                if (v.status === 'approved') content = <div className="absolute inset-1 bg-blue-500 rounded-sm shadow-sm" title={`Отпуск: ${dateStr}`}></div>; 
                                                else if (v.status === 'pending') content = <div className="absolute inset-1 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes-light.png')] bg-amber-200 rounded-sm border border-amber-300" title={`На согласовании: ${dateStr}`}></div>; 
                                                else if (v.status === 'draft') content = <div className="absolute inset-1 border-2 border-dashed border-gray-300 rounded-sm bg-gray-50" title={`Черновик: ${dateStr}`}></div>; 
                                            }
                                            return <div key={`cday-${u.id}-${mIdx}-${d}`} className={`w-8 flex-shrink-0 border-r border-gray-100 relative min-w-[28px] ${isToday ? 'bg-blue-100' : (isWe ? 'bg-gray-50' : 'bg-white')}`}>{content}</div>
                                        })
                                    })}</div>
                                </div>
                            ))}
                        </React.Fragment>)
                    })}
                </div>
            </div>
        </div>
    );
};
