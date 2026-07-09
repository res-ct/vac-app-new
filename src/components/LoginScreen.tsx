import React, { useState, useMemo } from 'react';
import { LogIn, User, Calendar, Lock, Search, Settings, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export const LoginScreen = ({ onLogin }: any) => {
    const { users, authSettings } = useAppContext();
    const [selectedUser, setSelectedUser] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showAdminPrompt, setShowAdminPrompt] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const sortedUsers = useMemo(() => {
        return [...users].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }, [users]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return sortedUsers;
        return sortedUsers.filter((u: any) => (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [sortedUsers, searchQuery]);

    const handleLogin = (e: any) => {
        e.preventDefault();
        const user = users.find((u: any) => u.id.toString() === selectedUser);
        if (user && user.password === password) { onLogin(user); } else { setError('Неверный пароль'); }
    };

    const handleGoogleLogin = async () => {
        if (isGoogleLoading) return;
        
        setIsGoogleLoading(true);
        setError('');
        
        try {
            const provider = new GoogleAuthProvider();
            // Добавляем custom parameters, чтобы принудительно запрашивать аккаунт, если нужно
            provider.setCustomParameters({ prompt: 'select_account' });
            
            const result = await signInWithPopup(auth, provider);
            const email = result.user.email;
            const user = users.find((u: any) => u.email === email);
            if (user) { 
                onLogin(user); 
            } else { 
                setError('Пользователь с таким email не найден в системе.'); 
                auth.signOut(); 
            }
        } catch (error: any) { 
            console.error("Google login error:", error); 
            
            // Обработка специфичных ошибок всплывающих окон внутри iframe
            if (error.code === 'auth/popup-blocked') {
                setError('Браузер заблокировал окно авторизации. Пожалуйста, разрешите всплывающие окна для этого сайта в настройках браузера.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                setError('Авторизация прервана (окно закрыто до завершения).');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Ошибка обычно возникает при множественных кликах, мы её глушим
                setError('Запрос отменен, так как был запущен новый. Попробуйте еще раз.');
            } else if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
                // Страховочный вариант для внутренней ошибки Firebase в iframe
                setError('Внутренняя ошибка авторизации Google. Пожалуйста, обновите страницу.');
            } else {
                setError('Ошибка авторизации Google. Проверьте права всплывающих окон.'); 
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const formatNameShort = (fullName: string) => {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return `${parts[0]} ${parts[1][0]}.`;
        }
        return fullName;
    };

    const selectedUserName = selectedUser ? formatNameShort(users.find((u: any) => u.id.toString() === selectedUser)?.name) : 'Выберите себя';

    const submitAdminLogin = (e: any) => {
        e.preventDefault();
        const adminUser = users.find((u: any) => u.role === 'admin');
        if (!adminUser) {
            setError('Администратор не найден в системе.');
            return;
        }
        if (adminPassword === adminUser.password) {
            onLogin(adminUser);
        } else {
            setError('Неверный пароль администратора');
        }
    };

    return (
        <div className="min-h-[750px] bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 relative">
                {!showAdminPrompt ? (
                    <button onClick={() => { setShowAdminPrompt(true); setError(''); }} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors" title="Вход для администратора">
                        <Lock className="w-4 h-4" />
                    </button>
                ) : (
                    <button onClick={() => { setShowAdminPrompt(false); setError(''); setAdminPassword(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors" title="Вернуться">
                        <X className="w-5 h-5" />
                    </button>
                )}
                
                <div className="text-center mb-8"><div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200"><Calendar className="w-8 h-8 text-white" /></div><h1 className="text-2xl font-bold text-gray-900">График отпусков</h1><p className="text-gray-500 mt-2">Управление отпусками сотрудников</p></div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center border border-red-100">{error}</div>}
                
                {showAdminPrompt ? (
                    <form onSubmit={submitAdminLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль администратора</label>
                            <div className="relative">
                                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50" placeholder="Введите пароль" autoFocus />
                                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5 pointer-events-none" />
                            </div>
                        </div>
                        <button type="submit" disabled={!adminPassword} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"><Settings className="w-5 h-5" /> Войти как Админ</button>
                    </form>
                ) : (
                    <>
                        {authSettings.password && (
                            <form onSubmit={handleLogin} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
                                    <div className="relative">
                                        <div 
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 cursor-pointer flex items-center justify-between"
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        >
                                            <span className={selectedUser ? "text-gray-900" : "text-gray-500"}>{selectedUserName}</span>
                                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5 pointer-events-none" />
                                        </div>
                                        {isDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
                                                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                                    <div className="relative">
                                                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                                        <input 
                                                            type="text" 
                                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" 
                                                            placeholder="Поиск по имени..." 
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto flex-1">
                                                    <div 
                                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${!selectedUser ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                        onClick={() => { setSelectedUser(''); setIsDropdownOpen(false); setSearchQuery(''); }}
                                                    >
                                                        Выберите себя
                                                    </div>
                                                    {filteredUsers.map((u: any) => (
                                                        <div 
                                                            key={u._docId || u.id} 
                                                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${selectedUser === u.id.toString() ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            onClick={() => { setSelectedUser(u.id.toString()); setIsDropdownOpen(false); setSearchQuery(''); }}
                                                        >
                                                            {formatNameShort(u.name)}
                                                        </div>
                                                    ))}
                                                    {filteredUsers.length === 0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">Ничего не найдено</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label><div className="relative"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50" placeholder="Введите пароль" /><Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5 pointer-events-none" /></div></div>
                                <button type="submit" disabled={!selectedUser || !password} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200"><LogIn className="w-5 h-5" /> Войти в систему</button>
                            </form>
                        )}
                        {(authSettings.google || authSettings.yandex) && authSettings.password && <div className="mt-6 flex items-center"><div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-400 text-sm">или</span><div className="flex-grow border-t border-gray-200"></div></div>}
                        <div className="mt-6 space-y-3">
                            {authSettings.google && (
                                <button 
                                    onClick={handleGoogleLogin} 
                                    disabled={isGoogleLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGoogleLoading ? (
                                        <div className="w-5 h-5 border-2 border-gray-400 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                    )}
                                    {isGoogleLoading ? 'Загрузка...' : 'Войти через Google'}
                                </button>
                            )}
                            {authSettings.yandex && (<button className="w-full flex items-center justify-center gap-3 bg-[#FFCC00] text-black py-3 rounded-xl font-medium hover:bg-[#F2C200] transition-colors"><div className="w-5 h-5 font-bold text-red-600 bg-white rounded-full flex items-center justify-center text-xs">Я</div>Войти через Яндекс</button>)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
