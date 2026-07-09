import React, { useState, useEffect } from 'react';
import { Mail, Save, Info, Play } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import emailjs from '@emailjs/browser';

export const EmailSettings = () => {
    const { emailTemplates, updateEmailTemplates, currentUser } = useAppContext();
    const [templates, setTemplates] = useState<any>({
        rejectionSubject: 'Заявка на отпуск отклонена',
        rejectionMessage: 'Здравствуйте, {{name}}. Ваша заявка на отпуск с {{startDate}} по {{endDate}} была отклонена руководителем.',
        rejectionCc: '',
        reminderSubject: 'Скоро отпуск у сотрудника',
        reminderMessage: 'Через 7 дней у сотрудника {{name}} начнется отпуск с {{startDate}} по {{endDate}}.',
        reminderCc: '',
        downloadPopupMessage: '{{name}}, распечатай скачанное заявление, подпиши и отправь скан на почту buh@test.ru'
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (emailTemplates) {
            setTemplates(emailTemplates);
        }
    }, [emailTemplates]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateEmailTemplates(templates);
            window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: { title: 'Сохранено', message: 'Шаблоны писем успешно обновлены', type: 'success' } 
            }));
        } catch (e) {
            console.error(e);
            window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: { title: 'Ошибка', message: 'Не удалось сохранить шаблоны', type: 'error' } 
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async (e: any) => {
        e.preventDefault();
        setIsTesting(true);
        window.dispatchEvent(new CustomEvent('app-toast', { 
            detail: { title: 'Отправка', message: 'Попытка отправить тестовое письмо...', type: 'self' } 
        }));
        try {
            const subject = templates.rejectionSubject || 'Тестовое письмо';
            let message = templates.rejectionMessage || 'Здравствуйте, {{name}}. Это тестовое сообщение.';
            message = message.replace(/{{name}}/g, 'Тестовый Сотрудник').replace(/{{startDate}}/g, '01.01.2024').replace(/{{endDate}}/g, '14.01.2024');

            const testEmail = currentUser?.email || 'test@example.com';

            await emailjs.send(
                'service_0rphyiq', 
                'template_ledfu5o', 
                { 
                    to_email: testEmail,
                    to_name: currentUser?.name || 'Тестовый Пользователь',
                    cc_emails: templates.rejectionCc || '',
                    subject: subject,
                    message: message + "\n\n(Это тестовое письмо из настроек)"
                }, 
                '5Q8hmgz0oZzkUr87Z'
            );

            window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: { title: 'Успех', message: `Тестовое письмо отправлено на ${testEmail}`, type: 'success' } 
            }));
        } catch (e: any) {
            console.error("Test email error:", e);
            window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: { title: 'Ошибка отправки', message: `EmailJS: ${e.text || e.message || 'Проверьте ключи и шаблоны.'}`, type: 'error' } 
            }));
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Mail className="w-5 h-5 text-blue-600" /> Шаблоны писем</h3>
                <div className="flex items-center gap-3">
                    <button onClick={handleTestEmail} disabled={isTesting} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50">
                        <Play className="w-4 h-4" /> {isTesting ? 'Отправка...' : 'Тест отправки'}
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
                        <Save className="w-4 h-4" /> {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
            <div className="p-6 space-y-8">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 items-start text-sm border border-blue-100">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                    <div>
                        <p className="font-semibold mb-1">Важно для поля "Копия (CC)":</p>
                        <p className="mb-2">Чтобы письма отправлялись дополнительным адресатам, вам необходимо зайти в настройки вашего шаблона на сайте <strong>EmailJS</strong> и в поле <strong>CC</strong> или <strong>BCC</strong> вставить переменную <code>{`{{cc_emails}}`}</code>.</p>
                        
                        <p className="font-semibold mb-1 mt-3">Доступные переменные для текста:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><code>{`{{name}}`}</code> — Имя сотрудника</li>
                            <li><code>{`{{startDate}}`}</code> — Дата начала отпуска</li>
                            <li><code>{`{{endDate}}`}</code> — Дата окончания отпуска</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 border-b pb-2">Уведомление об отклонении заявки (сотруднику)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Тема письма</label>
                            <input type="text" value={templates.rejectionSubject || ''} onChange={e => setTemplates({...templates, rejectionSubject: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Копия (CC)</label>
                            <input type="text" placeholder="hr@example.com, boss@example.com" value={templates.rejectionCc || ''} onChange={e => setTemplates({...templates, rejectionCc: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                            <p className="text-xs text-gray-500 mt-1">Email-адреса через запятую</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Текст письма</label>
                        <textarea value={templates.rejectionMessage || ''} onChange={e => setTemplates({...templates, rejectionMessage: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 border-b pb-2">Уведомление за 7 дней до отпуска (руководителю)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Тема письма</label>
                            <input type="text" value={templates.reminderSubject || ''} onChange={e => setTemplates({...templates, reminderSubject: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Копия (CC)</label>
                            <input type="text" placeholder="accounting@example.com" value={templates.reminderCc || ''} onChange={e => setTemplates({...templates, reminderCc: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                            <p className="text-xs text-gray-500 mt-1">Email-адреса через запятую</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Текст письма</label>
                        <textarea value={templates.reminderMessage || ''} onChange={e => setTemplates({...templates, reminderMessage: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 border-b pb-2">Уведомление после скачивания заявления</h4>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Текст сообщения в окне</label>
                        <textarea value={templates.downloadPopupMessage || ''} onChange={e => setTemplates({...templates, downloadPopupMessage: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y" />
                        <p className="text-xs text-gray-500 mt-1">Поддерживается переменная <code>{`{{name}}`}</code></p>
                    </div>
                </div>
            </div>
        </div>
    );
};
