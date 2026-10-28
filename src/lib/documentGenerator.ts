import { Document, Paragraph, TextRun, Packer, AlignmentType, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { parseDateLocalObj } from './utils';

export const generateVacationDocument = async (user: any, startDate: string, endDate: string, daysCount: number) => {
    const sDate = parseDateLocalObj(startDate);
    
    // Formatting date as '«14» июля'
    const genitiveMonths = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    const formattedMonth = genitiveMonths[sDate.getMonth()];
    const day = sDate.getDate();

    const currentDt = new Date();
    const currentFormattedMonth = genitiveMonths[currentDt.getMonth()];
    const currentDay = currentDt.getDate().toString().padStart(2, '0');

    const getGenitiveName = (nameStr: string) => {
        const parts = nameStr.trim().split(/\s+/);
        if (parts.length >= 2) {
            let [lastName, firstName, patronymic] = parts;
            // lastName
            if (lastName.endsWith('ов') || lastName.endsWith('ев') || lastName.endsWith('ин') || lastName.endsWith('ын')) lastName += 'а';
            else if (lastName.endsWith('ова') || lastName.endsWith('ева') || lastName.endsWith('ина') || lastName.endsWith('ына')) lastName = lastName.slice(0, -1) + 'ой';
            else if (lastName.endsWith('ий')) lastName = lastName.slice(0, -2) + 'ого';
            else if (lastName.endsWith('ая')) lastName = lastName.slice(0, -2) + 'ой';

            if (firstName) {
                if (firstName.endsWith('й')) firstName = firstName.slice(0, -1) + 'я';
                else if (firstName.endsWith('я')) firstName = firstName.slice(0, -1) + 'и';
                else if (firstName.endsWith('а')) firstName = firstName.slice(0, -1) + 'ы';
                else if (patronymic && patronymic.endsWith('ич') && !firstName.match(/[аеёиоуыэюя]$/i)) firstName += 'а';
            }

            if (patronymic) {
                if (patronymic.endsWith('ич')) patronymic += 'а';
                else if (patronymic.endsWith('на')) patronymic = patronymic.slice(0, -1) + 'ы';
            }

            return `${lastName} ${firstName ? firstName[0] + '.' : ''}${patronymic ? patronymic[0] + '.' : ''}`;
        }
        return nameStr;
    };

    const getGenitivePosition = (posStr: string) => {
        if (!posStr) return '';
        const words = posStr.trim().split(/\s+/);
        let result = [];
        let foundNoun = false;
        
        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            let lWord = word.toLowerCase();
            
            if (lWord === 'по' || lWord === 'в' || lWord === 'на' || lWord === 'и') {
                foundNoun = true;
                result.push(word);
                continue;
            }
            
            if (!foundNoun) {
                let isAdjective = lWord.endsWith('ий') || lWord.endsWith('ый') || lWord.endsWith('ая') || lWord.endsWith('яя');
                
                if (lWord.endsWith('ий')) word = word.slice(0, -2) + 'его';
                else if (lWord.endsWith('ый')) word = word.slice(0, -2) + 'ого';
                else if (lWord.endsWith('ая')) word = word.slice(0, -2) + 'ой';
                else if (lWord.endsWith('яя')) word = word.slice(0, -2) + 'ей';
                else if (lWord.endsWith('ь')) word = word.slice(0, -1) + 'я';
                else if (lWord.endsWith('й')) word = word.slice(0, -1) + 'я';
                else if (lWord.endsWith('а')) {
                    if (/[гкхжчшщ]/.test(lWord.slice(-2, -1))) word = word.slice(0, -1) + 'и';
                    else word = word.slice(0, -1) + 'ы';
                }
                else if (lWord.endsWith('я')) word = word.slice(0, -1) + 'и';
                else if (/[бвгджзклмнпрстфхцчшщ]$/i.test(lWord)) word = word + 'а';
                
                if (!isAdjective) {
                    foundNoun = true;
                }
            }
            result.push(word);
        }
        return result.join(' ').toLowerCase();
    };
    
    // Create document
    const doc = new Document({
        creator: "Graphik Otpuskov",
        title: "Заявление на отпуск",
        description: "Заявление на ежегодный основной оплачиваемый отпуск",
        styles: {
            default: {
                document: {
                    run: {
                        size: 24, // 12pt
                        font: "Arial",
                    },
                },
            },
        },
        sections: [{
            properties: {},
            children: [
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("Генеральному директору")] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("ООО «РЭС Креативные технологии»")] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("Староверову Е.А.")] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(`от ${getGenitivePosition(user.position || user.department || 'должность')}`)] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(`${getGenitiveName(user.name)}`)] }),
                new Paragraph({
                    text: "",
                    spacing: { after: 400 },
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "ЗАЯВЛЕНИЕ",
                            bold: true,
                        }),
                    ],
                }),
                new Paragraph({
                    text: "",
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun(`Прошу предоставить мне ежегодный основной оплачиваемый отпуск с «${day}» ${formattedMonth} ${sDate.getFullYear()} года продолжительностью ${daysCount} календарных дней.`),
                    ],
                }),
                new Paragraph({
                    text: "",
                    spacing: { after: 400 },
                }),
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun(`Дата заявления: «${currentDay}» ${currentFormattedMonth} ${currentDt.getFullYear()} года`),
                    ],
                }),
                new Paragraph({
                    text: "",
                    spacing: { after: 400 },
                }),
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun(`Подпись _________________________ ${user.name}`),
                    ],
                }),
            ],
        }],
    });

    const currentMonthPadded = (currentDt.getMonth() + 1).toString().padStart(2, '0');
    const currentYearShort = currentDt.getFullYear().toString().slice(-2);
    const docDateStr = `${currentDay}.${currentMonthPadded}.${currentYearShort}`;

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Заявление на отпуск ${user.name} от ${docDateStr}.docx`);
};
