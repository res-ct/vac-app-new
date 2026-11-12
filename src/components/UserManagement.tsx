import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Download, FileText, Upload, UserPlus, CheckSquare, Square, Pencil, Trash2, AlertTriangle, Briefcase, PieChart, PlusCircle, ArrowUpDown, ChevronLeft, ChevronRight, Calendar, Sparkles, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ConfirmModal } from './ConfirmModal';
import { CarryOverModal } from './CarryOverModal';
import { addDoc, collection, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { CURRENT_YEAR, FULL_MONTHS } from '../lib/constants';
import { countBillableDays, calculateUserVacationStatsForYear, calculateSuggestedCarryOver, calculateAccruedQuotaForYear } from '../lib/utils';

export const UserManagement = () => {
    const { users, departments, vacations, holidays, logAction } = useAppContext();
    const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
    const [isAdding, setIsAdding] = useState(false), [editingUser, setEditingUser] = useState<any>(null), [formData, setFormData] = useState({ name: '', email: '', department: departments[0] || '', position: '', hireDate: '', yearlyAllowance: 28, carryOverDays: 0, role: 'employee', password: '123' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [confirmDelete, setConfirmDelete] = useState<any>(null), [confirmDeleteAll, setConfirmDeleteAll] = useState(false), [importInfo, setImportInfo] = useState<any>(null), [selectedIds, setSelectedIds] = useState<number[]>([]), [bulkModal, setBulkModal] = useState<any>(null), [bulkValue, setBulkValue] = useState('');
    const [carryOverModalUser, setCarryOverModalUser] = useState<any>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        if (bulkModal || confirmDelete || confirmDeleteAll) {
            if ('parentIFrame' in window && (window as any).parentIFrame) {
                (window as any).parentIFrame.scrollToOffset(0, 0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [bulkModal, confirmDelete, confirmDeleteAll]);

    const resetForm = () => { setFormData({ name: '', email: '', department: departments[0] || '', position: '', hireDate: '', yearlyAllowance: 28, carryOverDays: 0, role: 'employee', password: '123' }); setEditingUser(null); setIsAdding(false); };
    const handleEdit = (user: any) => { setEditingUser(user); setFormData({ ...user }); setIsAdding(true); };
    
    const handleDelete = async () => { if (confirmDelete && confirmDelete._docId) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', confirmDelete._docId)); logAction('DELETE_USER', `Удален сотрудник: ${confirmDelete.name}`, confirmDelete.id, confirmDelete); setConfirmDelete(null); } };
    const handleSubmit = async (e: any) => { 
        e.preventDefault(); const avatar = formData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2); 
        if (editingUser && editingUser._docId) { 
            const oldUser = users.find((u: any) => u._docId === editingUser._docId);
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', editingUser._docId), { ...formData, avatar }); 
            logAction('EDIT_USER', `Изменены данные сотрудника: ${formData.name}`, editingUser._docId, oldUser, { ...formData, avatar });
        } else { 
            const newId = Date.now();
            const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), { ...formData, id: newId, avatar }); 
            logAction('ADD_USER', `Добавлен сотрудник: ${formData.name}`, docRef.id, null, { ...formData, id: newId, avatar, _docId: docRef.id });
        } 
        resetForm(); 
    };

    const handleDeleteAllUsers = async () => { const batch = writeBatch(db); const usersToDelete = users.filter((u: any) => u.role !== 'admin'); usersToDelete.forEach((u: any) => { if (u._docId) batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'users', u._docId)); }); await batch.commit(); logAction('DELETE_ALL_USERS', `Удалены все сотрудники`); setConfirmDeleteAll(false); };
    const downloadTemplate = () => { const headers = "ФИО,Отдел,Роль (employee/manager/ceo),Дата найма (YYYY-MM-DD),Email\nИван Петров,IT Отдел,employee,2024-01-15,ivan@example.com"; const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', 'employees_template.csv'); document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    
    const handleExportSchedule = () => { 
        let csvContent = `,,Остаток отпуска на 31.12.${selectedYear - 1},`; FULL_MONTHS.forEach(m => csvContent += `${m},,,,`); csvContent += `Суммарное количество в графике,Остаток дней неиспользованных дней отпуска на 31.12.${selectedYear}\n,,,`; FULL_MONTHS.forEach(() => csvContent += "дата начала,дата окончания,кол-во дней,согласование руководителя,"); csvContent += ",,\n"; 
        users.filter((u: any) => u.role !== 'admin').forEach((user: any) => { 
            const userVacations = vacations.filter((v: any) => v.userId === user.id && v.status === 'approved'); 
            const stats = calculateUserVacationStatsForYear(user, vacations, holidays, selectedYear);
            const totalAllowance = stats.totalAllowance; 
            let row = `${user.id},${user.name},${stats.carryOverDays},`, totalUsed = 0; 
            for (let i = 0; i < 12; i++) { 
                const vac = userVacations.find((v: any) => { const d = new Date(v.startDate); return d.getMonth() === i && d.getFullYear() === selectedYear; }); 
                if (vac) { const days = countBillableDays(vac.startDate, vac.endDate, holidays); totalUsed += days; row += `${vac.startDate},${vac.endDate},${days},согласовано,`; } else { row += ",,,,"; } 
            } 
            row += `${totalUsed},${totalAllowance - totalUsed}\n`; csvContent += row; 
        }); 
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `Vacation_Schedule_${selectedYear}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
    };
    
    const handleFileUpload = (e: any) => { 
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); 
        reader.onload = async (evt: any) => { 
            const lines = evt.target.result.split('\n'); const newUsers: any[] = []; const newDeptsToCreate = new Set<string>();
            lines.forEach((line: string, index: number) => { 
                const parts = line.split(',').map(s => s.trim()); 
                if (parts.length >= 2 && index > 0 && parts[0]) { 
                    const name = parts[0], dept = parts[1] || 'Без отдела'; 
                    if (dept !== 'Без отдела' && !departments.includes(dept)) newDeptsToCreate.add(dept);
                    const role = parts[2] === 'manager' ? 'manager' : parts[2] === 'ceo' ? 'ceo' : 'employee', date = parts[3] || new Date().toISOString().split('T')[0], email = parts[4] || '', avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2); 
                    newUsers.push({ id: Date.now() + index, name, department: dept, email, role, yearlyAllowance: 28, carryOverDays: 0, hireDate: date, password: '123', avatar }); 
                } 
            }); 
            if (newUsers.length > 0) { 
                const batch = writeBatch(db); 
                newDeptsToCreate.forEach(deptName => { const deptRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'departments')); batch.set(deptRef, { name: deptName }); });
                const createdUserIds: string[] = [];
                newUsers.forEach(u => { const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users')); createdUserIds.push(ref.id); batch.set(ref, u); }); 
                await batch.commit(); 
                logAction('BULK_IMPORT', `Массовый импорт: загружено ${newUsers.length} сотрудников`);
                setImportInfo({ message: `Успешно загружено ${newUsers.length} сотрудников${newDeptsToCreate.size > 0 ? ` и добавлено ${newDeptsToCreate.size} новых отделов` : ''}`, isError: false }); 
            } else setImportInfo({ message: 'Ошибка: Не удалось распознать данные', isError: true }); 
            setTimeout(() => setImportInfo(null), 3000); 
        }; 
        reader.readAsText(file); e.target.value = ''; 
    };

    const sortedUsers = useMemo(() => {
        return [...users.filter((u: any) => u.role !== 'admin')].sort((a: any, b: any) => {
            const nameA = (a.name || '').trim();
            const nameB = (b.name || '').trim();
            const cmp = nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
            return sortOrder === 'asc' ? cmp : -cmp;
        });
    }, [users, sortOrder]);

    const visibleUsers = sortedUsers;
    const allSelected = visibleUsers.length > 0 && visibleUsers.every((u: any) => selectedIds.includes(u.id));
    const toggleSelectAll = () => { if (allSelected) setSelectedIds([]); else setSelectedIds(visibleUsers.map((u: any) => u.id)); };
    const toggleSelectUser = (id: number) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id)); else setSelectedIds([...selectedIds, id]); };
    
    const handleBulkSave = async () => { 
        if (bulkModal.type !== 'autoCarryOver' && bulkModal.type !== 'autoQuota' && bulkValue === '') return; 
        const batch = writeBatch(db); 
        
        users.forEach((u: any) => { 
            if (selectedIds.includes(u.id) && u._docId) { 
                const ref = doc(db, 'artifacts', appId, 'public', 'data', 'users', u._docId); 
                if (bulkModal.type === 'department') {
                    batch.update(ref, { department: bulkValue }); 
                } else if (bulkModal.type === 'quota') {
                    const q = Number(bulkValue);
                    const updatedQuotas = { ...(u.yearlyQuotas || {}), [selectedYear]: q };
                    const payload: any = { yearlyQuotas: updatedQuotas };
                    if (selectedYear === CURRENT_YEAR) payload.yearlyAllowance = q;
                    batch.update(ref, payload);
                } else if (bulkModal.type === 'carryOver') {
                    const c = Number(bulkValue);
                    const updatedCarryOvers = { ...(u.carryOvers || {}), [selectedYear]: c };
                    const payload: any = { carryOvers: updatedCarryOvers };
                    if (selectedYear === CURRENT_YEAR) payload.carryOverDays = c;
                    batch.update(ref, payload);
                } else if (bulkModal.type === 'autoCarryOver') {
                    const { suggestedCarryOver } = calculateSuggestedCarryOver(u, vacations, holidays, selectedYear);
                    const updatedCarryOvers = { ...(u.carryOvers || {}), [selectedYear]: suggestedCarryOver };
                    const payload: any = { carryOvers: updatedCarryOvers };
                    if (selectedYear === CURRENT_YEAR) payload.carryOverDays = suggestedCarryOver;
                    batch.update(ref, payload);
                } else if (bulkModal.type === 'autoQuota') {
                    const accrued = calculateAccruedQuotaForYear(u, selectedYear, 28);
                    const updatedQuotas = { ...(u.yearlyQuotas || {}), [selectedYear]: accrued.quota };
                    const payload: any = { yearlyQuotas: updatedQuotas };
                    if (selectedYear === CURRENT_YEAR) payload.yearlyAllowance = accrued.quota;
                    batch.update(ref, payload);
                }
            } 
        }); 
        await batch.commit(); 
        logAction('BULK_EDIT', `Массовое изменение для ${selectedIds.length} сотрудников на ${selectedYear} год: ${bulkModal.type}`);
        setBulkModal(null); setBulkValue(''); setSelectedIds([]); 
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative pb-16">
            {importInfo && (<div className={`absolute top-0 left-0 right-0 p-2 text-center text-sm font-medium z-20 ${importInfo.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{importInfo.message}</div>)}
            <div className="p-6 border-b border-gray-200 flex flex-wrap justify-between items-center bg-gray-50 gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5 text-gray-500" /> Все сотрудники ({visibleUsers.length})</h3>
                    {/* Year Selector for Admin Panel */}
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 px-2.5 py-1.5 rounded-lg text-xs shadow-2xs font-medium">
                        <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-600" /> Год:</span>
                        <button 
                            type="button" 
                            onClick={() => setSelectedYear(y => y - 1)} 
                            className="p-0.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="Предыдущий год"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-gray-900 px-1">{selectedYear}</span>
                        <button 
                            type="button" 
                            onClick={() => setSelectedYear(y => y + 1)} 
                            className="p-0.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="Следующий год"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <button onClick={downloadTemplate} className="bg-white border border-gray-300 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2" title="Скачать шаблон"><Download className="w-3 h-3" /> Шаблон</button>
                    <button onClick={handleExportSchedule} className="bg-white border border-gray-300 text-green-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-green-50 flex items-center gap-2" title="Экспорт графика (CSV)"><FileText className="w-3 h-3" /> Экспорт графика</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"><Upload className="w-3 h-3" /> Импорт</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                    {!isAdding && <button onClick={() => setIsAdding(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2"><UserPlus className="w-3 h-3" /> Добавить</button>}
                </div>
            </div>
            
            {isAdding && (
                <div className="p-6 border-b border-gray-200 bg-indigo-50 animate-fadeIn">
                    <h4 className="font-bold text-gray-800 mb-4">{editingUser ? 'Редактирование сотрудника' : 'Новый сотрудник'}</h4>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">ФИО</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Email (для входа)</label><input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="user@company.com" /></div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Отдел</label><select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-white">{departments.map((d: string, i: number) => <option key={`opt-${i}`} value={d}>{d}</option>)}</select></div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Должность</label><input type="text" value={formData.position || ''} onChange={e => setFormData({...formData, position: e.target.value})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Разработчик" /></div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Роль</label><select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"><option value="employee">Сотрудник</option><option value="manager">Руководитель</option><option value="ceo">СЕО</option><option value="admin">Администратор</option></select></div>
                        <div className="flex flex-col">
                            <label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Дата найма</label>
                            <input 
                                type="date" 
                                required 
                                value={formData.hireDate} 
                                onChange={e => {
                                    const newDate = e.target.value;
                                    const hYear = newDate ? parseInt(newDate.split('-')[0], 10) : null;
                                    const accrued = newDate && hYear ? calculateAccruedQuotaForYear({ hireDate: newDate }, hYear, 28) : null;
                                    setFormData(f => ({
                                        ...f, 
                                        hireDate: newDate,
                                        yearlyAllowance: (accrued && accrued.isHireYear && !editingUser) ? accrued.quota : f.yearlyAllowance
                                    }));
                                }} 
                                className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Квота (дней/год)</label>
                            <input 
                                type="number" 
                                required 
                                value={formData.yearlyAllowance} 
                                onChange={e => setFormData({...formData, yearlyAllowance: Number(e.target.value)})} 
                                className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Остаток прошлых лет</label><input type="number" required value={formData.carryOverDays} onChange={e => setFormData({...formData, carryOverDays: Number(e.target.value)})} className="px-3 py-2 rounded border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                        <div className="flex flex-col"><label className="text-xs text-gray-500 font-semibold mb-1 uppercase">Пароль</label><div className="flex items-center border border-indigo-200 rounded px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-indigo-500"><input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full outline-none text-sm" /></div></div>
                        
                        {(() => {
                            if (!formData.hireDate) return null;
                            const hYear = parseInt(formData.hireDate.split('-')[0], 10);
                            if (isNaN(hYear)) return null;
                            const accrued = calculateAccruedQuotaForYear({ hireDate: formData.hireDate }, hYear, 28);
                            return (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-xs bg-indigo-100/70 border border-indigo-200 p-2.5 rounded-lg flex items-center justify-between flex-wrap gap-2 text-indigo-950">
                                    <div>
                                        <span className="font-bold">Расчет квоты по годам:</span> В год найма ({hYear} г.) расчетная квота составляет <b>{accrued.quota} дн.</b> ({accrued.workedMonths} мес.). В последующие полные годы (с {hYear + 1} г.) квота автоматически составит <b>28 дней</b>.
                                    </div>
                                    {formData.yearlyAllowance !== accrued.quota && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, yearlyAllowance: accrued.quota }))}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition-colors"
                                        >
                                            Установить {accrued.quota} дн. на {hYear} г.
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex gap-2 col-span-1 md:col-span-2 lg:col-span-3 justify-end items-end"><button type="button" onClick={resetForm} className="px-4 py-2 bg-white text-gray-600 border rounded hover:bg-gray-50 transition-colors">Отмена</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">Сохранить</button></div>
                    </form>
                </div>
            )}
            
            <div className="overflow-auto max-h-96">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="p-3 w-8">
                                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600">
                                    {allSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                                </button>
                            </th>
                            <th className="p-3">
                                <button
                                    type="button"
                                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    className="flex items-center gap-1.5 font-bold text-gray-700 hover:text-indigo-600 transition-colors group cursor-pointer"
                                    title="Сортировка сотрудников по алфавиту"
                                >
                                    <span>ФИО / Email</span>
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" />
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                                        {sortOrder === 'asc' ? 'А → Я' : 'Я → А'}
                                    </span>
                                </button>
                            </th>
                            <th className="p-3">Отдел / Должность</th>
                            <th className="p-3 text-center">Квота / Остаток ({selectedYear} г.)</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleUsers.map((u: any) => {
                            const stats = calculateUserVacationStatsForYear(u, vacations, holidays, selectedYear);
                            return (
                                <tr key={u._docId || u.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-3"><button onClick={()=>toggleSelectUser(u.id)} className="text-gray-300 hover:text-indigo-500">{selectedIds.includes(u.id)?<CheckSquare className="w-5 h-5 text-indigo-600"/>:<Square className="w-5 h-5 text-gray-300"/>}</button></td>
                                    <td className="p-3 font-medium text-gray-800">{u.name} <span className="text-xs text-gray-400">({u.role})</span><div className="text-[10px] text-gray-500 font-normal">{u.email || 'Нет email'}</div></td>
                                    <td className="p-3 text-gray-500">{u.department}<div className="text-[10px] text-gray-400">{u.position || ''}</div></td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="font-bold text-gray-800 flex items-center gap-1" title={stats.quotaReason || `Квота на ${selectedYear} г.`}>
                                                {stats.yearlyQuota}
                                                {stats.isHireYear && (
                                                    <span 
                                                        className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded leading-none" 
                                                        title={`Неполный год (принят ${u.hireDate}, отработано ${stats.workedMonths} мес.). В последующие полные годы квота составит 28 дн.`}
                                                    >
                                                        неполн.
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-gray-300">/</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setCarryOverModalUser(u)} 
                                                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-0.5 border border-emerald-200" 
                                                title={`Нажмите, чтобы настроить квоту и остаток на ${selectedYear} год с подсказкой системы`}
                                            >
                                                +{stats.carryOverDays || 0}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleEdit(u)} className="text-blue-500 p-1 hover:bg-blue-50 rounded" title="Редактировать"><Pencil className="w-3 h-3"/></button>
                                        <button onClick={() => setConfirmDelete(u)} className="text-red-400 p-1 hover:bg-red-50 rounded" title="Удалить"><Trash2 className="w-3 h-3"/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="p-3 border-t border-gray-200 bg-gray-50"><button onClick={()=>setConfirmDeleteAll(true)} className="text-red-500 text-xs flex gap-1 items-center hover:text-red-700"><AlertTriangle className="w-3 h-3"/> Удалить ВСЕХ</button></div>

            {selectedIds.length > 0 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 z-20 animate-bounce-in max-w-3xl flex-wrap justify-center">
                    <span className="text-sm font-medium whitespace-nowrap">Выбрано: {selectedIds.length}</span><div className="h-4 w-px bg-gray-700"></div>
                    <button onClick={() => setBulkModal({ type: 'department' })} className="text-xs hover:text-indigo-300 transition-colors flex items-center gap-1"><Briefcase className="w-3 h-3" /> Сменить отдел</button>
                    <button onClick={() => setBulkModal({ type: 'quota' })} className="text-xs hover:text-indigo-300 transition-colors flex items-center gap-1"><PieChart className="w-3 h-3" /> Квота ({selectedYear} г.)</button>
                    <button onClick={() => setBulkModal({ type: 'autoQuota' })} className="text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 px-2 py-1 rounded transition-colors flex items-center gap-1 font-semibold" title={`Рассчитать квоту на ${selectedYear} г. по дате найма (28 дн. для полных лет, расчет по месяцам для года приема)`}><Sparkles className="w-3 h-3" /> Авто-квота ({selectedYear} г.)</button>
                    <button onClick={() => setBulkModal({ type: 'carryOver' })} className="text-xs hover:text-indigo-300 transition-colors flex items-center gap-1"><PlusCircle className="w-3 h-3" /> Остаток ({selectedYear} г.)</button>
                    <button onClick={() => setBulkModal({ type: 'autoCarryOver' })} className="text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-1 rounded transition-colors flex items-center gap-1 font-semibold" title={`Рассчитать остатки на ${selectedYear} г. по итогам ${selectedYear - 1} г.`}><Sparkles className="w-3 h-3" /> Авто-остаток ({selectedYear} г.)</button>
                    <button onClick={() => setSelectedIds([])} className="ml-1 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            {bulkModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-2 text-center">
                            {bulkModal.type === 'department' ? 'Смена отдела' 
                             : bulkModal.type === 'quota' ? `Квота на ${selectedYear} год` 
                             : bulkModal.type === 'autoQuota' ? `Авто-расчет квоты на ${selectedYear} год`
                             : bulkModal.type === 'carryOver' ? `Остаток на ${selectedYear} год`
                             : `Авто-расчет остатка на ${selectedYear} год`}
                        </h4>
                        <p className="text-xs text-gray-500 mb-4 text-center">Для {selectedIds.length} выбранных сотрудников</p>
                        
                        {bulkModal.type === 'department' ? (
                            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full mb-6 px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Выберите отдел</option>{departments.map((d: string, i: number) => <option key={`bm-${i}`} value={d}>{d}</option>)}</select>
                        ) : bulkModal.type === 'autoCarryOver' ? (
                            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                                Система автоматически пересчитает и запишет остатки на <b>{selectedYear} год</b> с учетом фактически согласованных отпусков в <b>{selectedYear - 1} году</b> для каждого выбранного сотрудника.
                            </div>
                        ) : bulkModal.type === 'autoQuota' ? (
                            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
                                Система установит квоту на <b>{selectedYear} год</b> с учетом стажа: для сотрудников с полным рабочим годом — <b>28 дней</b>, а для принятых в {selectedYear} году — <b>пропорционально отработанным месяцам</b>.
                            </div>
                        ) : (
                            <input 
                                type="number" 
                                placeholder={bulkModal.type === 'quota' ? `Новая квота на ${selectedYear} г. (дней)` : `Остаток на ${selectedYear} г. (дней)`} 
                                value={bulkValue} 
                                onChange={(e) => setBulkValue(e.target.value)} 
                                className="w-full mb-6 px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => { setBulkModal(null); setBulkValue(''); }} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">Отмена</button>
                            <button onClick={handleBulkSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                                {(bulkModal.type === 'autoCarryOver' || bulkModal.type === 'autoQuota') ? 'Рассчитать и применить' : 'Применить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal isOpen={!!confirmDelete} title="Удаление сотрудника" message={confirmDelete ? `Вы уверены, что хотите удалить сотрудника ${confirmDelete.name}? Это действие необратимо.` : ''} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
            <ConfirmModal isOpen={confirmDeleteAll} title="Удаление ВСЕХ сотрудников" message="ВНИМАНИЕ! Это действие удалит всех сотрудников (кроме админа)." confirmText="Удалить всех" onConfirm={handleDeleteAllUsers} onCancel={() => setConfirmDeleteAll(false)} />

            <CarryOverModal
                isOpen={!!carryOverModalUser}
                onClose={() => setCarryOverModalUser(null)}
                targetUser={carryOverModalUser}
                initialYear={selectedYear}
            />
        </div>
    );
};
