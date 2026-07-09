import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, Users, Briefcase, Settings, Bell, LogOut, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const Header = ({ onLogout }: any) => {
  const { currentUser: user, vacations, users } = useAppContext();
  const [showNotifs, setShowNotifs] = useState(false);
  const [activePopups, setActivePopups] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null), shownNotifsRef = useRef(new Set()); 

  useEffect(() => {
      const handleClickOutside = (e: any) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
      document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
      if (!user || !vacations || !users) return [];
      const notifs: any[] = [], today = new Date(); today.setHours(0,0,0,0);
      const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
      const isSubordinate = (reqUser: any) => {
          if (!reqUser || reqUser.id === user.id) return false;
          if (user.role === 'ceo') return reqUser.role === 'manager' || (reqUser.role === 'employee' && !users.some((u: any) => u.department === reqUser.department && u.role === 'manager'));
          if (user.role === 'manager') return reqUser.department === user.department && reqUser.role === 'employee';
          return false;
      };
      vacations.forEach((v: any) => {
          if (v.status !== 'approved') return;
          const startDate = new Date(v.startDate); startDate.setHours(0,0,0,0);
          if (startDate >= today && startDate <= nextWeek) {
              const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), daysText = diffDays === 0 ? 'сегодня' : diffDays === 1 ? 'завтра' : `через ${diffDays} дн.`;
              if (v.userId === user.id) notifs.push({ id: `self-${v._docId || v.id}`, title: 'Ваш отпуск', message: `Начинается ${daysText} (${new Date(v.startDate).toLocaleDateString()})`, type: 'self', date: startDate });
              else { const reqUser = users.find((u: any) => u.id === v.userId); if (isSubordinate(reqUser)) notifs.push({ id: `sub-${v._docId || v.id}`, title: `Отпуск: ${reqUser.name}`, message: `Начинается ${daysText}`, type: 'subordinate', date: startDate }); }
          }
      });
      return notifs.sort((a, b) => a.date - b.date);
  }, [user, vacations, users]);

  useEffect(() => {
      if (notifications.length > 0) {
          const newPopups = notifications.filter(n => !shownNotifsRef.current.has(n.id));
          if (newPopups.length > 0) { newPopups.forEach(n => shownNotifsRef.current.add(n.id)); setActivePopups(prev => [...prev, ...newPopups]); newPopups.forEach(n => setTimeout(() => setActivePopups(prev => prev.filter(p => p.id !== n.id)), 6000)); }
      }
  }, [notifications]);

  useEffect(() => {
      const handleCustomToast = (e: any) => { const newPopup = { id: Date.now() + Math.random().toString(), ...e.detail }; setActivePopups(prev => [...prev, newPopup]); setTimeout(() => setActivePopups(prev => prev.filter(p => p.id !== newPopup.id)), 6000); };
      window.addEventListener('app-toast', handleCustomToast); return () => window.removeEventListener('app-toast', handleCustomToast);
  }, []);

  if (!user) return null;
  let roleIcon = <Calendar className="text-white w-6 h-6" />, headerBg = 'bg-blue-600', badgeBg = 'bg-blue-100 text-blue-700';
  if (user.role === 'admin') { roleIcon = <Settings className="text-white w-6 h-6" />; headerBg = 'bg-indigo-600'; badgeBg = 'bg-indigo-100 text-indigo-700'; }
  else if (user.role === 'manager') { roleIcon = <Briefcase className="text-white w-6 h-6" />; headerBg = 'bg-emerald-600'; badgeBg = 'bg-emerald-100 text-emerald-700'; }
  else if (user.role === 'ceo') { roleIcon = <Users className="text-white w-6 h-6" />; headerBg = 'bg-purple-600'; badgeBg = 'bg-purple-100 text-purple-700'; }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm"><div className="flex items-center gap-2"><div className={`${headerBg} p-2 rounded-lg transition-colors`}>{roleIcon}</div><h1 className="text-xl font-bold text-gray-800">{user.role === 'admin' ? 'HR Панель' : 'График отпусков'}</h1></div><div className="flex items-center gap-4">{user.role !== 'admin' && (<div className="relative" ref={notifRef}><button onClick={() => setShowNotifs(!showNotifs)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"><Bell className="w-5 h-5" />{notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>{showNotifs && (<div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-fadeIn"><div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800 text-sm">Уведомления</h3><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{notifications.length}</span></div><div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? <div className="p-4 text-center text-sm text-gray-500">Нет ближайших отпусков</div> : (<div className="divide-y divide-gray-50">{notifications.map(n => (<div key={n.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-3 items-start"><div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'self' ? 'bg-blue-500' : 'bg-orange-400'}`}></div><div><p className="text-xs font-bold text-gray-800">{n.title}</p><p className="text-sm text-gray-600 leading-snug">{n.message}</p></div></div>))}</div>)}</div></div>)}</div>)}<div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${badgeBg}`}>{user.avatar}</div><div className="flex flex-col"><span className="text-sm font-semibold text-gray-700">{user.name}</span><span className="text-xs text-gray-500">{user.department}</span></div></div><button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"><span className="text-sm font-medium">Выйти</span><LogOut className="w-4 h-4" /></button></div></div>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">{activePopups.map(p => (<div key={`popup-${p.id}`} className="bg-white border border-gray-100 shadow-2xl rounded-xl p-4 flex items-start gap-3 w-80 pointer-events-auto animate-fadeIn relative" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}><div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${p.type === 'self' ? 'bg-blue-500' : p.type === 'success' ? 'bg-green-500' : p.type === 'error' ? 'bg-red-500' : 'bg-orange-400'}`}></div><div className="flex-1"><h4 className="text-sm font-bold text-gray-800 mb-0.5">{p.title}</h4><p className="text-xs text-gray-600 leading-snug">{p.message}</p></div><button onClick={() => setActivePopups(prev => prev.filter(x => x.id !== p.id))} className="text-gray-400 hover:text-gray-800 transition-colors p-1 hover:bg-gray-100 rounded-md"><X className="w-4 h-4" /></button></div>))}</div>
    </>
  );
};
