/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, auth, appId } from './firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { AppContext } from './context/AppContext';
import { INITIAL_USERS_DATA, INITIAL_DEPARTMENTS_DATA, GLOBAL_HOLIDAYS, CURRENT_YEAR } from './lib/constants';
import { parseDateLocalObj } from './lib/utils';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { UserView } from './components/UserView';
import { AdminDashboard } from './components/AdminDashboard';
import { ManagerApprovals } from './components/ManagerApprovals';
import { ManagerAnalyticsPage } from './components/ManagerAnalyticsPage';
import { PieChart } from 'lucide-react';
import emailjs from '@emailjs/browser';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptDocs, setDeptDocs] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any>(GLOBAL_HOLIDAYS);
  const [authSettings, setAuthSettings] = useState<any>({ password: true, google: false, yandex: false });
  const [emailTemplates, setEmailTemplates] = useState<any>({
    rejectionSubject: 'Заявка на отпуск отклонена',
    rejectionMessage: 'Здравствуйте, {{name}}. Ваша заявка на отпуск с {{startDate}} по {{endDate}} была отклонена руководителем.',
    rejectionCc: '',
    reminderSubject: 'Скоро отпуск у сотрудника',
    reminderMessage: 'Через 7 дней у сотрудника {{name}} начнется отпуск с {{startDate}} по {{endDate}}.',
    reminderCc: '',
    downloadPopupMessage: '{{name}}, распечатай скачанное заявление, подпиши и отправь скан на почту buh@test.ru'
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(CURRENT_YEAR, new Date().getMonth(), 1));
  const [viewMode, setViewMode] = useState('month');
  const [showManagerAnalytics, setShowManagerAnalytics] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), 
      (snap) => setUsers(snap.docs.map(d => ({ ...d.data(), _docId: d.id }))),
      (err) => console.error("Users snapshot error:", err)
    );
    const unsubDepts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'departments'), 
      (snap) => {
        const docs: any[] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        const uniqueNames = new Set();
        const duplicates: any[] = [];
        docs.forEach((d: any) => {
          const name = (d.name || '').trim();
          if (uniqueNames.has(name.toLowerCase())) duplicates.push(d);
          else uniqueNames.add(name.toLowerCase());
        });
        
        if (duplicates.length > 0 && auth.currentUser) {
          duplicates.forEach(async (d) => {
            try {
              await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'departments', d.id));
            } catch (e) { console.error("Failed to delete duplicate dept:", e); }
          });
        }
        
        const uniqueDocs = docs.filter(d => !duplicates.includes(d));
        setDeptDocs(uniqueDocs); 
        setDepartments(uniqueDocs.map((d: any) => d.name));
      },
      (err) => console.error("Departments snapshot error:", err)
    );
    const unsubVacs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'vacations'), 
      (snap) => setVacations(snap.docs.map(d => ({ ...d.data(), _docId: d.id }))),
      (err) => console.error("Vacations snapshot error:", err)
    );
    const unsubHolidays = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'holidays'), 
      (snap) => { if (snap.exists()) setHolidays(snap.data()); },
      (err) => console.error("Holidays snapshot error:", err)
    );
    const unsubAuth = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth'), 
      (snap) => { if (snap.exists()) setAuthSettings(snap.data()); },
      (err) => console.error("Auth settings snapshot error:", err)
    );
    const unsubEmailTpls = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'email_templates'), 
      (snap) => { if (snap.exists()) setEmailTemplates(snap.data()); },
      (err) => console.error("Email templates snapshot error:", err)
    );
    const unsubAudit = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'), 
      (snap) => setAuditLogs(snap.docs.map(d => ({ ...d.data(), _docId: d.id })).sort((a: any, b: any) => b.timestamp - a.timestamp)),
      (err) => console.error("Audit logs snapshot error:", err)
    );
    const unsubFirebase = onAuthStateChanged(auth, (user) => {
        setIsReady(true);
    });

    return () => { unsubUsers(); unsubDepts(); unsubVacs(); unsubHolidays(); unsubAuth(); unsubEmailTpls(); unsubAudit(); unsubFirebase(); };
  }, []);

  useEffect(() => {
    if (!isReady || vacations.length === 0 || users.length === 0) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    vacations.forEach(async (v) => {
      if (v.status === 'approved' && !v.notified7Days) {
        const startDate = new Date(v.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7 && diffDays > 0) {
          const emp = users.find(u => u.id === v.userId);
          if (emp) {
            const manager = users.find(u => u.department === emp.department && u.role === 'manager');
            if (manager) {
              window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: { 
                  title: 'Уведомление руководителю', 
                  message: `Отправлено письмо руководителю: Через 7 дней у сотрудника ${emp.name} начнется отпуск.`, 
                  type: 'email' 
                } 
              }));
              
              const subject = emailTemplates.reminderSubject || 'Скоро отпуск у сотрудника';
              let message = emailTemplates.reminderMessage || 'Через 7 дней у сотрудника {{name}} начнется отпуск с {{startDate}} по {{endDate}}.';
              message = message.replace(/{{name}}/g, emp.name).replace(/{{startDate}}/g, new Date(v.startDate).toLocaleDateString()).replace(/{{endDate}}/g, new Date(v.endDate).toLocaleDateString());

              emailjs.send(
                'service_0rphyiq', 
                'template_ledfu5o', 
                { 
                  to_email: manager.email,
                  to_name: manager.name,
                  cc_emails: emailTemplates.reminderCc || '',
                  subject: subject,
                  message: message
                }, 
                '5Q8hmgz0oZzkUr87Z'
              ).catch((e: any) => {
                console.error(e);
                window.dispatchEvent(new CustomEvent('app-toast', { 
                  detail: { 
                    title: 'Ошибка отправки письма', 
                    message: `EmailJS: ${e.text || e.message || 'Проверьте Service ID и настройки.'}`, 
                    type: 'error' 
                  } 
                }));
              });
              
              if (v._docId && auth.currentUser) {
                try {
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vacations', v._docId), { ...v, notified7Days: true });
                } catch (e) { console.error("Failed to update vacation notification status:", e); }
              }
            }
          }
        }
      }
    });
  }, [vacations, users, isReady]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('savedUserId');
    if (users.length > 0) {
      if (currentUser) {
        const matched = users.find(u => u.id === currentUser.id);
        if (matched && JSON.stringify(matched) !== JSON.stringify(currentUser)) {
          setCurrentUser(matched);
        }
      } else if (auth.currentUser) {
        const matchedUser = users.find(u => u.email === auth.currentUser?.email);
        if (matchedUser) {
          setCurrentUser(matchedUser);
          localStorage.setItem('savedUserId', matchedUser.id.toString());
        }
      } else if (savedUserId) {
        const matchedUser = users.find(u => u.id.toString() === savedUserId);
        if (matchedUser) {
          setCurrentUser(matchedUser);
        } else {
          localStorage.removeItem('savedUserId');
        }
      }
    }
  }, [users, currentUser]);

  const logAction = async (type: string, details: string, targetId?: string, previousData?: any, newData?: any) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'), {
        timestamp: Date.now(), userId: currentUser?.id || 'system', userName: currentUser?.name || 'System',
        type, details, targetId: targetId || null, previousData: previousData || null, newData: newData || null, reverted: false
      });
    } catch (e) { console.error("Audit log error:", e); }
  };

  const handleAddVacation = async (vacation: any) => {
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'vacations'), { ...vacation, id: Date.now() });
    const startStr = parseDateLocalObj(vacation.startDate).toLocaleDateString();
    const endStr = parseDateLocalObj(vacation.endDate).toLocaleDateString();
    logAction('CREATE_VACATION', `Создана заявка на отпуск (${vacation.status}) с ${startStr} по ${endStr}`, docRef.id, null, { ...vacation, id: Date.now(), _docId: docRef.id });
  };

  const handleUpdateVacation = async (vacation: any) => {
    if (!vacation._docId) return;
    const oldVac = vacations.find(v => v._docId === vacation._docId);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vacations', vacation._docId), vacation);
    logAction('UPDATE_VACATION', `Обновлена заявка на отпуск (статус: ${vacation.status})`, vacation._docId, oldVac, vacation);
  };

  const handleDeleteVacation = async (id: number) => {
    const vac = vacations.find(v => v.id === id);
    if (vac && vac._docId) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vacations', vac._docId));
      logAction('DELETE_VACATION', `Удалена заявка на отпуск`, vac._docId, vac);
    }
  };

  const updateEmailTemplates = async (newTemplates: any) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'email_templates'), newTemplates);
  };

  if (!isReady) return <div className="min-h-[750px] flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  if (!currentUser) return (
      <AppContext.Provider value={{ users, authSettings }}>
          <LoginScreen onLogin={(user: any) => { localStorage.setItem('savedUserId', user.id.toString()); setCurrentUser(user); }} />
      </AppContext.Provider>
  );

  const calendarProps = {
      currentMonthDate,
      onPrev: () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - (viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1), 1)),
      onNext: () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + (viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1), 1)),
      onPrevYear: () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear() - 1, currentMonthDate.getMonth(), 1)),
      onNextYear: () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear() + 1, currentMonthDate.getMonth(), 1)),
      viewMode, setViewMode
  };

  return (
    <AppContext.Provider value={{ currentUser, users, departments, deptDocs, vacations, holidays, authSettings, auditLogs, logAction, emailTemplates, updateEmailTemplates }}>
      <div className="min-h-[750px] bg-gray-50/50 font-sans text-gray-900 pb-12">
        <Header onLogout={() => { auth.signOut(); localStorage.removeItem('savedUserId'); setCurrentUser(null); }} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentUser.role === 'admin' ? <AdminDashboard /> : (
            <>
              {(currentUser.role === 'manager' || currentUser.role === 'ceo') && (
                <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">{currentUser.role === 'ceo' ? 'CEO' : 'RUK'}</div><div><h2 className="font-bold text-gray-800">Панель руководителя</h2><p className="text-xs text-gray-500">Управление отделом и согласование отпусков</p></div></div>
                  <button onClick={() => setShowManagerAnalytics(!showManagerAnalytics)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${showManagerAnalytics ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><PieChart className="w-4 h-4" /> Аналитика отдела</button>
                </div>
              )}
              {(currentUser.role === 'manager' || currentUser.role === 'ceo') && !showManagerAnalytics && <ManagerApprovals onUpdateVacation={handleUpdateVacation} />}
              {showManagerAnalytics ? <ManagerAnalyticsPage onBack={() => setShowManagerAnalytics(false)} /> : <UserView onAdd={handleAddVacation} onUpdate={handleUpdateVacation} onDel={handleDeleteVacation} calendarProps={calendarProps} />}
            </>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
