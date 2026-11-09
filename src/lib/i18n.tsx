import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'ru' | 'kk'
export const LANGS: { code: Lang; label: string; locale: string }[] = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'ru', label: 'Русский', locale: 'ru-RU' },
  { code: 'kk', label: 'Қазақша', locale: 'kk-KZ' },
]

const KEY = 'peakly.lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'ru' || saved === 'kk') return saved
  } catch {
    /* storage unavailable */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  if (nav.startsWith('ru')) return 'ru'
  if (nav.startsWith('kk')) return 'kk'
  return 'en'
}

const KK_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
const KK_MONTHS_DAT = ['қаңтарға', 'ақпанға', 'наурызға', 'сәуірге', 'мамырға', 'маусымға', 'шілдеге', 'тамызға', 'қыркүйекке', 'қазанға', 'қарашаға', 'желтоқсанға']
const KK_MONTHS_SHORT = ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел']
const KK_WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі']
const KK_WEEKDAYS_SHORT = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб']

export type DateOpts = Intl.DateTimeFormatOptions & {
  /** "until <date>" form: Kazakh needs the dative ("2031 жылғы 7 қаңтарға дейін"), other languages are unchanged */
  until?: boolean
}

/** Formats a date in the selected language (own Kazakh names; no stray "г." in Russian). */
export function formatDate(input: string | Date, o: DateOpts = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const lang = detect()
  const pad = (n: number) => String(n).padStart(2, '0')

  if (lang === 'kk') {
    const m = d.getMonth()
    const month = o.until ? KK_MONTHS_DAT[m] : o.month === 'short' ? KK_MONTHS_SHORT[m] : KK_MONTHS[m]
    let s = o.until && o.year ? `${d.getFullYear()} жылғы ${d.getDate()} ${month}` : `${o.day ? d.getDate() + ' ' : ''}${month}${o.year ? ' ' + d.getFullYear() : ''}`
    if (o.weekday) s = `${(o.weekday === 'long' ? KK_WEEKDAYS : KK_WEEKDAYS_SHORT)[d.getDay()]}, ${s}`
    if (o.hour) s += `, ${pad(d.getHours())}:${pad(d.getMinutes())}`
    return s
  }

  const { until: _until, ...intl } = o
  void _until
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  return new Intl.DateTimeFormat(locale, intl).format(d).replace(/\s*г\.(?=[\s,]|$)/g, '')
}

/** Locale for dates/numbers, readable outside React components. */
export function getLocale(): string {
  return LANGS.find((l) => l.code === detect())?.locale ?? 'en-US'
}

/**
 * English text is the key. Each entry is [Russian, Kazakh]. Missing keys fall back to English,
 * so new UI text never breaks - it just shows in English until it is added here.
 */
const D: Record<string, [string, string]> = {
  // navigation & chrome
  'SAT': ['SAT', 'SAT'],
  'Courses': ['Курсы', 'Курстар'],
  'Practice': ['Практика', 'Жаттығу'],
  'Support': ['Поддержка', 'Қолдау'],
  'Open app': ['Открыть приложение', 'Қосымшаны ашу'],
  'Log in': ['Войти', 'Кіру'],
  'Get Started': ['Начать', 'Бастау'],
  'Menu': ['Меню', 'Мәзір'],
  'Home': ['Главная', 'Басты бет'],
  'Learn': ['Уроки', 'Сабақтар'],
  'Profile': ['Профиль', 'Профиль'],
  'Notifications': ['Уведомления', 'Хабарландырулар'],
  "You're all caught up. No new notifications.": ['Всё прочитано. Новых уведомлений нет.', 'Бәрі оқылды. Жаңа хабарландыру жоқ.'],
  'Lessons': ['Уроки', 'Сабақтар'],
  'Word Lists': ['Списки слов', 'Сөздер тізімі'],
  'Words': ['Слова', 'Сөздер'],
  'SAT vocabulary, list by list.': ['Слова для SAT — список за списком.', 'SAT сөздері — тізім бойынша.'],
  'All word lists completed': ['Все списки слов пройдены', 'Барлық сөздер тізімі өтілді'],
  'No word lists here yet.': ['Здесь пока нет списков слов.', 'Мұнда әзірге сөздер тізімі жоқ.'],
  'Word list': ['Список слов', 'Сөздер тізімі'],
  'All word lists': ['Все списки слов', 'Барлық сөздер тізімі'],
  'Practice Tests': ['Пробные тесты', 'Жаттығу тесттері'],
  'Statistics': ['Статистика', 'Статистика'],
  'Admin panel': ['Админ-панель', 'Әкімші панелі'],
  'Admin': ['Админ', 'Әкімші'],
  'My account': ['Мой кабинет', 'Жеке кабинет'],
  'Log out': ['Выйти', 'Шығу'],
  'Language': ['Язык', 'Тіл'],

  // landing
  'Prepare for the SAT.': ['Готовься к SAT.', 'SAT-қа дайындал.'],
  'Get into your dream university.': ['Поступай в университет мечты.', 'Арманыңдағы университетке түс.'],
  'A smart learning platform with lessons, practice, and progress tracking.': [
    'Умная платформа с уроками, практикой и отслеживанием прогресса.',
    'Сабақтар, жаттығулар және прогресті бақылау — бәрі бір ақылды платформада.',
  ],
  'Start Learning': ['Начать учиться', 'Оқуды бастау'],
  'Learn More': ['Узнать больше', 'Толығырақ'],
  'SAT Preparation': ['Подготовка к SAT', 'SAT-қа дайындық'],
  'Reading · Writing · Math': ['Чтение · Письмо · Математика', 'Оқу · Жазу · Математика'],
  'Knowledge Building': ['Развитие знаний', 'Білімді дамыту'],
  'Key subjects & skills': ['Ключевые предметы и навыки', 'Негізгі пәндер мен дағдылар'],
  'Scroll': ['Вниз', 'Төмен'],
  'Scroll to results': ['К результатам', 'Нәтижелерге өту'],
  'Total score': ['Общий балл', 'Жалпы балл'],
  'Aim for the': ['Стремись к', 'Мақсат —'],
  'top score': ['высшему баллу', 'ең жоғары балл'],
  'Lessons, timed practice and progress tracking built around one goal: 1580 and above.': [
    'Уроки, практика на время и отслеживание прогресса ради одной цели: 1580 и выше.',
    'Сабақтар, уақытқа шектелген жаттығулар және прогресті бақылау бір мақсатқа бағытталған: 1580 және одан жоғары.',
  ],
  'Real SAT results of PeaklyPrep students.': ['Реальные результаты SAT учеников PeaklyPrep.', 'PeaklyPrep оқушыларының нақты SAT нәтижелері.'],
  'SAT score report: {total}': ['Отчёт о баллах SAT: {total}', 'SAT балл есебі: {total}'],
  'Reading & Writing': ['Чтение и письмо', 'Оқу және жазу'],

  // auth
  'Welcome back': ['С возвращением', 'Қайта қош келдіңіз'],
  'Log in to continue your SAT preparation': ['Войдите, чтобы продолжить подготовку к SAT', 'SAT-қа дайындықты жалғастыру үшін кіріңіз'],
  'Email': ['Эл. почта', 'Эл. пошта'],
  'Password': ['Пароль', 'Құпия сөз'],
  'Logging in…': ['Входим…', 'Кіріп жатырмыз…'],
  'New here?': ['Впервые здесь?', 'Алғаш рет келдіңіз бе?'],
  'Create an account': ['Создать аккаунт', 'Аккаунт ашу'],
  'Create your account': ['Создайте аккаунт', 'Аккаунт ашыңыз'],
  'Start preparing for the SAT today': ['Начните готовиться к SAT уже сегодня', 'SAT-қа дайындықты бүгін бастаңыз'],
  'Full name': ['Полное имя', 'Аты-жөні'],
  'Creating…': ['Создаём…', 'Аккаунт ашылуда…'],
  'Check your inbox to confirm your email, then log in.': ['Проверьте почту, подтвердите адрес и войдите.', 'Поштаңызды тексеріп, эл. пошта мекенжайыңызды растаңыз, содан кейін кіріңіз.'],
  'Go to log in': ['Перейти ко входу', 'Кіруге өту'],
  'Already have an account?': ['Уже есть аккаунт?', 'Аккаунтыңыз бар ма?'],
  'Enter a valid email': ['Введите корректную почту', 'Дұрыс эл. пошта мекенжайын енгізіңіз'],
  'Enter your password': ['Введите пароль', 'Құпия сөзді енгізіңіз'],
  'Enter your name': ['Введите имя', 'Атыңызды енгізіңіз'],
  'At least 8 characters': ['Минимум 8 символов', 'Кемінде 8 таңба'],
  'Invalid login credentials': ['Неверная почта или пароль', 'Эл. пошта немесе құпия сөз қате'],
  'User already registered': ['Пользователь уже зарегистрирован', 'Бұл пайдаланушы бұрыннан тіркелген'],
  'Could not log in': ['Не удалось войти', 'Кіру мүмкін болмады'],
  'Could not create account': ['Не удалось создать аккаунт', 'Аккаунт ашу мүмкін болмады'],

  // home
  'Hi, {name}!': ['Привет, {name}!', 'Сәлем, {name}!'],
  'Student': ['Ученик', 'Оқушы'],
  'Exam date not chosen': ['Дата экзамена не выбрана', 'Емтихан күні таңдалмаған'],
  '{n} days until the SAT': ['До SAT {n} дн.', 'SAT-қа {n} күн қалды'],
  'SAT is today': ['SAT сегодня', 'SAT бүгін'],
  'SAT date has passed': ['Дата SAT прошла', 'SAT күні өтіп кетті'],
  'Choose date': ['Выбрать дату', 'Күнді таңдау'],
  'Today': ['Сегодня', 'Бүгін'],
  'Take your first practice test and your score projection will appear here.': [
    'Пройдите первый пробный тест, и здесь появится прогноз балла.',
    'Алғашқы жаттығу тестін тапсырыңыз — балл болжамы осында пайда болады.',
  ],
  'Projected score: {s}': ['Прогноз балла: {s}', 'Болжамды балл: {s}'],
  ' · {n} points to your goal': [' · до цели {n} баллов', ' · мақсатқа {n} балл қалды'],
  ' · you are on track for your goal': [' · вы на пути к цели', ' · мақсатқа қарай дұрыс жолдасыз'],
  'Goal': ['Цель', 'Мақсат'],
  '{a}/{b} lessons · {c}/{d} practice tests': ['{a}/{b} уроков · {c}/{d} тестов', '{a}/{b} сабақ · {c}/{d} тест'],
  'My Progress': ['Мой прогресс', 'Менің прогресім'],
  'Recent activity': ['Последняя активность', 'Соңғы белсенділік'],
  'No practice tests yet. Take your first one to see results here.': [
    'Тестов пока нет. Пройдите первый, чтобы увидеть результаты.',
    'Әзірге тест тапсырылмаған. Нәтижені осында көру үшін алғашқысын тапсырыңыз.',
  ],
  'Practice test': ['Пробный тест', 'Жаттығу тесті'],
  'News': ['Новости', 'Жаңалықтар'],
  'Loading…': ['Загрузка…', 'Жүктелуде…'],
  'No news yet.': ['Новостей пока нет.', 'Әзірге жаңалық жоқ.'],

  // progress
  'Readiness': ['Готовность', 'Дайындық деңгейі'],
  'Tests taken': ['Пройдено тестов', 'Тапсырылған тесттер'],
  'Average score': ['Средний балл', 'Орташа балл'],
  'Best score': ['Лучший балл', 'Үздік балл'],
  'Lessons done': ['Пройдено уроков', 'Өтілген сабақтар'],
  'Score history': ['История результатов', 'Нәтижелер тарихы'],
  'Complete a practice test to see your trend.': ['Пройдите пробный тест, чтобы увидеть динамику.', 'Нәтиже динамикасын көру үшін жаттығу тестін тапсырыңыз.'],
  'Test attempts': ['Попытки тестов', 'Тест тапсыру әрекеттері'],
  'Nothing here yet.': ['Пока пусто.', 'Мұнда әзірге ештеңе жоқ.'],
  'Start a practice test': ['Начать пробный тест', 'Жаттығу тестін бастау'],

  // profile & settings
  'Name': ['Имя', 'Аты'],
  "Used to log in and can't be changed": ['Используется для входа, изменить нельзя', 'Кіру үшін қолданылады, өзгертуге болмайды'],
  'Target SAT score': ['Целевой балл SAT', 'SAT бойынша мақсатты балл'],
  'Daily study time': ['Время занятий в день', 'Күнделікті оқу уақыты'],
  'SAT exam date': ['Дата экзамена SAT', 'SAT емтиханының күні'],
  'Not set': ['Не указана', 'Көрсетілмеген'],
  'Email updates': ['Рассылка по email', 'Эл. пошта арқылы хабарламалар'],
  'Get tips and reminders': ['Получать советы и напоминания', 'Кеңестер мен еске салғыштар алу'],
  'Save': ['Сохранить', 'Сақтау'],
  'Cancel': ['Отмена', 'Бас тарту'],
  'Privacy Policy': ['Политика конфиденциальности', 'Құпиялылық саясаты'],
  'Terms of Use': ['Условия использования', 'Пайдалану шарттары'],
  'Open admin panel': ['Открыть админ-панель', 'Әкімші панелін ашу'],
  'Settings': ['Настройки', 'Баптаулар'],
  'Drag to set your goal': ['Перетащите, чтобы выбрать цель', 'Мақсатты орнату үшін сырғытыңыз'],
  'Drag to set your daily time': ['Перетащите, чтобы выбрать время', 'Күнделікті уақытты орнату үшін сырғытыңыз'],
  'Quick pick': ['Быстрый выбор', 'Жылдам таңдау'],
  '{h} h': ['{h} ч', '{h} сағ'],
  '{m} min': ['{m} мин', '{m} мин'],
  '{h} h {m} min': ['{h} ч {m} мин', '{h} сағ {m} мин'],
  'Loading official dates…': ['Загружаем официальные даты…', 'Ресми күндер жүктелуде…'],
  "I haven't picked a date yet": ['Я ещё не выбрал(а) дату', 'Күнді әлі таңдаған жоқпын'],
  'Registration closed': ['Регистрация закрыта', 'Тіркелу жабылды'],
  'Register by {d}': ['Регистрация до {d}', 'Тіркелудің соңғы күні: {d}'],
  'Choose one of the official dates': ['Выберите одну из официальных дат', 'Ресми күндердің бірін таңдаңыз'],
  'Official dates from College Board, updated automatically.': ['Официальные даты College Board, обновляются автоматически.', 'College Board-тың ресми күндері автоматты түрде жаңартылып отырады.'],
  'Could not reach College Board right now; showing the last known official dates.': [
    'Сейчас не удалось связаться с College Board — показаны последние известные официальные даты.',
    'Қазір College Board-пен байланысу мүмкін болмады, сондықтан соңғы белгілі ресми күндер көрсетілген.',
  ],

  // statistics & learning path
  'Track your progress by skill': ['Отслеживай свой прогресс по навыкам', 'Дағдылар бойынша прогресіңді бақылап отыр'],
  'Overview': ['Обзор', 'Шолу'],
  'No practice tests yet. Start your first test!': ['Пробных тестов пока нет. Начни первый тест!', 'Жаттығу тесттері әлі жоқ. Алғашқы тестті бастаңыз!'],
  'No {section} tests yet. Start your first one!': ['Тестов по разделу «{section}» пока нет. Начни первый!', '«{section}» бөлімі бойынша тест әлі жоқ. Алғашқысын бастаңыз!'],
  'Recent attempts': ['Последние попытки', 'Соңғы әрекеттер'],
  'Lessons completed': ['Пройдено уроков', 'Өтілген сабақтар'],
  'Your learning path': ['Твой путь обучения', 'Оқу жолыңыз'],
  '{a}/{b} done · ~{m} min': ['{a}/{b} выполнено · ~{m} мин', '{a}/{b} орындалды · ~{m} мин'],
  'Short lessons that build the skills tested on the SAT.': ['Короткие уроки, которые развивают навыки, проверяемые на SAT.', 'SAT-та тексерілетін дағдыларды дамытатын қысқа сабақтар.'],
  'Continue': ['Продолжить', 'Жалғастыру'],
  'All lessons completed': ['Все уроки пройдены', 'Барлық сабақ өтілді'],
  'Lesson': ['Урок', 'Сабақ'],
  'Completed': ['Пройден', 'Өтілді'],
  'Full practice': ['Полная практика', 'Толық жаттығу'],
  '{n} questions': ['{n} вопросов', '{n} сұрақ'],
  '~{n} min': ['~{n} мин', '~{n} мин'],
  'Take a test': ['Пройти тест', 'Тест тапсыру'],

  // student-produced (typed) answers
  'Student-Produced Response': ['Ответ, введённый учеником', 'Оқушы енгізетін жауап'],
  'Enter your answer…': ['Введите ответ…', 'Жауабыңызды енгізіңіз…'],
  'Enter a number, a fraction like 3/4, or a decimal. Negative answers start with a minus sign.': [
    'Введите число, дробь вида 3/4 или десятичную дробь. Отрицательный ответ начинается со знака минус.',
    'Сан, 3/4 сияқты бөлшек немесе ондық бөлшек енгізіңіз. Теріс жауап минус белгісінен басталады.',
  ],
  'Your answer': ['Ваш ответ', 'Сіздің жауабыңыз'],
  'Correct answer': ['Правильный ответ', 'Дұрыс жауап'],
  'or': ['или', 'немесе'],

  // deleting old attempts
  'Clear history': ['Очистить историю', 'Тарихты тазалау'],
  'Delete attempt': ['Удалить попытку', 'Талпынысты жою'],
  'Delete this attempt? This cannot be undone.': ['Удалить эту попытку? Это действие нельзя отменить.', 'Бұл талпынысты жою керек пе? Мұны қайтару мүмкін емес.'],
  'Delete all {n} attempts? This cannot be undone.': ['Удалить все попытки ({n})? Это действие нельзя отменить.', 'Барлық талпыныстарды ({n}) жою керек пе? Мұны қайтару мүмкін емес.'],

  // math tools
  'Calculator': ['Калькулятор', 'Калькулятор'],
  'Reference': ['Справочник', 'Анықтамалық'],
  'Graphing': ['Графический', 'Графикалық'],
  'Scientific': ['Научный', 'Ғылыми'],
  'Expand': ['Развернуть', 'Үлкейту'],
  'Collapse': ['Свернуть', 'Кішірейту'],
  'Drag to resize': ['Потяните, чтобы изменить размер', 'Өлшемін өзгерту үшін сүйреңіз'],
  'Loading calculator…': ['Загрузка калькулятора…', 'Калькулятор жүктелуде…'],
  'Could not load the calculator. Check your internet connection.': ['Не удалось загрузить калькулятор. Проверьте подключение к интернету.', 'Калькулятор жүктелмеді. Интернет байланысын тексеріңіз.'],
  'Special Right Triangles': ['Особые прямоугольные треугольники', 'Ерекше тікбұрышты үшбұрыштар'],
  'The number of degrees of arc in a circle is 360.': ['Число градусов дуги в круге равно 360.', 'Шеңбердегі доғаның градус саны 360.'],
  'The number of radians of arc in a circle is 2π.': ['Число радиан дуги в круге равно 2π.', 'Шеңбердегі доғаның радиан саны 2π.'],
  'The sum of the measures in degrees of the angles of a triangle is 180.': ['Сумма градусных мер углов треугольника равна 180.', 'Үшбұрыш бұрыштарының градустық өлшемдерінің қосындысы 180.'],

  // daily tasks
  'Daily tasks': ['Задачи на сегодня', 'Бүгінгі тапсырмалар'],
  'All tasks for today are done': ['Все задачи на сегодня выполнены', 'Бүгінгі барлық тапсырма орындалды'],
  'No tasks yet': ['Задач пока нет', 'Тапсырма әзірге жоқ'],
  'Up next': ['Дальше', 'Келесі'],

  // practice test forms & modules
  'Choose module': ['Выбрать модуль', 'Модульді таңдау'],
  'Modules: {n}': ['Модулей: {n}', 'Модуль саны: {n}'],
  'Full exam with multiple modules': ['Полный экзамен из нескольких модулей', 'Бірнеше модульден тұратын толық емтихан'],
  '{q} questions · ~{m} min': ['{q} вопросов · ~{m} мин', '{q} сұрақ · ~{m} мин'],
  'Select Module to Practice': ['Выберите модуль для практики', 'Жаттығуға модульді таңдаңыз'],
  'Choose which module to practice from {form}': ['Выберите, какой модуль пройти из «{form}»', '«{form}» ішінен қай модульді өтетініңізді таңдаңыз'],
  'Module {n}': ['Модуль {n}', '{n}-модуль'],
  'Start Module {n}': ['Начать модуль {n}', '{n}-модульді бастау'],
  'Start both modules': ['Пройти оба модуля подряд', 'Екі модульді қатарынан өту'],
  'Both modules in one session, one after another': ['Оба модуля за одну сессию, один за другим', 'Екі модуль бір сессияда, бірінен соң бірі'],
  'Continue to Module {n}': ['Перейти к модулю {n}', '{n}-модульге өту'],
  'Module {n} complete': ['Модуль {n} завершён', '{n}-модуль аяқталды'],
  'Total so far: {s} of {t} correct': ['Всего: {s} из {t} верно', 'Барлығы: {t}-дан {s} дұрыс'],

  // plans & subscription
  'Subscription': ['Подписка', 'Жазылым'],
  'Buy a plan': ['Купить тариф', 'Тариф сатып алу'],
  'Renew plan': ['Продлить тариф', 'Тарифті ұзарту'],
  'Plans': ['Тарифы', 'Тарифтер'],
  'Current plan': ['Текущий тариф', 'Ағымдағы тариф'],
  'No active plan': ['Нет активного тарифа', 'Белсенді тариф жоқ'],
  'Active until {d}': ['Активен до {d}', '{d} дейін белсенді'],
  '{n} days left': ['осталось {n} дн.', '{n} күн қалды'],
  'Plan activated': ['Тариф активирован', 'Тариф іске қосылды'],
  'Activating…': ['Активируем…', 'Іске қосылуда…'],
  '{plan} is active until {d}.': ['Тариф «{plan}» активен до {d}.', '«{plan}» тарифі {d} дейін белсенді.'],
  'Test mode: no real payment was made.': ['Тестовый режим: реальная оплата не проводилась.', 'Сынақ режимі: нақты төлем жасалған жоқ.'],

  // pricing
  'Launch pricing': ['Стартовые цены', 'Іске қосу бағалары'],
  'Invest in your next step.': ['Инвестируй в свой следующий шаг.', 'Келесі қадамыңа инвестиция сал.'],
  'Simple SAT preparation plans. One payment for your chosen period.': ['Простые тарифы для подготовки к SAT. Один платёж за выбранный период.', 'SAT-қа дайындалудың қарапайым тарифтері. Таңдалған кезеңге бір төлем.'],
  '1 Month': ['1 месяц', '1 ай'],
  '{n} Months': ['{n} мес.', '{n} ай'],
  'Regular total': ['Обычная цена', 'Әдеттегі баға'],
  'Launch price': ['Цена запуска', 'Іске қосу бағасы'],
  '{p}/month': ['{p}/мес.', '{p}/ай'],
  'monthly equivalent': ['в пересчёте на месяц', 'айына шаққанда'],
  'Total payment': ['К оплате', 'Төлем сомасы'],
  'Choose plan': ['Выбрать тариф', 'Тарифті таңдау'],
  'Best value': ['Лучшая цена', 'Ең тиімді'],
  'All amounts in USD. Launch pricing shown as the full upfront payment, not a monthly charge.': ['Все суммы в долларах США. Цена запуска показана как полная предоплата, а не ежемесячный платёж.', 'Барлық сома АҚШ долларымен. Іске қосу бағасы толық алдын ала төлем ретінде көрсетілген, айлық төлем емес.'],
  'Online payment is coming soon': ['Онлайн-оплата скоро появится', 'Онлайн төлем жақында қосылады'],
  'You chose {plan} for {price}. Payment is not connected yet; we will let you know when it opens.': ['Вы выбрали тариф «{plan}» за {price}. Оплата пока не подключена, мы сообщим, когда она откроется.', 'Сіз «{plan}» тарифін {price} бағасымен таңдадыңыз. Төлем әлі қосылмаған, ашылған кезде хабарлаймыз.'],

  // full test result  'Full test result': ['Результат всего теста', 'Бүкіл тесттің нәтижесі'],

  // attempt history
  'Attempt history': ['История попыток', 'Әрекеттер тарихы'],
  'Review mistakes': ['Разбор ошибок', 'Қателерді талдау'],
  'Attempt not found': ['Попытка не найдена', 'Әрекет табылмады'],
  'Only mistakes': ['Только ошибки', 'Тек қателер'],
  'No mistakes in this attempt': ['В этой попытке ошибок нет', 'Бұл әрекетте қате жоқ'],
  'Taken on {d}': ['Пройден {d}', '{d} күні тапсырылды'],
  'No attempts yet': ['Попыток пока нет', 'Әрекет әлі жоқ'],

  // lessons & practice
  'All': ['Все', 'Барлығы'],
  'Reading': ['Чтение', 'Оқу'],
  'Writing': ['Письмо', 'Жазу'],
  'Math': ['Математика', 'Математика'],
  'No lessons here yet.': ['Здесь пока нет уроков.', 'Мұнда әзірге сабақ жоқ.'],
  '{n} min': ['{n} мин', '{n} мин'],
  'Lesson not found.': ['Урок не найден.', 'Сабақ табылмады.'],
  'All lessons': ['Все уроки', 'Барлық сабақтар'],
  'Watch video': ['Смотреть видео', 'Бейнені көру'],
  'Completed — mark as not done': ['Пройден — отметить как не пройденный', 'Өтілді — өтілмеген деп белгілеу'],
  'Mark as completed': ['Отметить как пройденный', 'Өтілді деп белгілеу'],
  'No tests here yet.': ['Здесь пока нет тестов.', 'Мұнда әзірге тест жоқ.'],
  '{m} min · {n} questions': ['{m} мин · {n} вопросов', '{m} мин · {n} сұрақ'],
  'Best: {p}%': ['Лучший: {p}%', 'Үздік: {p}%'],
  'Not taken yet': ['Ещё не пройден', 'Әлі тапсырылмаған'],
  'Retake': ['Пройти снова', 'Қайта тапсыру'],
  'Start': ['Начать', 'Бастау'],
  'Coming soon': ['Скоро', 'Жақында'],
  'This test has no questions yet.': ['В этом тесте пока нет вопросов.', 'Бұл тестте әзірге сұрақ жоқ.'],
  'Back to tests': ['К тестам', 'Тесттерге оралу'],
  'Previous': ['Предыдущий', 'Алдыңғы'],
  'Next': ['Далее', 'Келесі'],
  'Directions': ['Инструкция', 'Нұсқаулық'],
  'Show': ['Показать', 'Көрсету'],
  'Hide': ['Скрыть', 'Жасыру'],
  'Questions': ['Вопросы', 'Сұрақтар'],
  'Choose the best answer for each question. Use Mark for Review to flag a question and the ABC button to cross out answers you have ruled out. The test is scored when you finish or when time runs out.': [
    'Выберите лучший ответ на каждый вопрос. «Отметить для проверки» помечает вопрос, кнопка ABC зачёркивает отброшенные варианты. Тест оценивается, когда вы завершите его или истечёт время.',
    'Әр сұраққа ең дұрыс жауапты таңдаңыз. «Қайта қарауға белгілеу» батырмасы сұрақты белгілейді, ал ABC батырмасы қате деп есептеген нұсқаларыңызды сызып тастайды. Тест сіз оны аяқтағанда немесе уақыт біткенде бағаланады.',
  ],
  'Mark for Review': ['Отметить для проверки', 'Қайта қарауға белгілеу'],
  'PRACTICE TEST': ['ПРОБНЫЙ ТЕСТ', 'ЖАТТЫҒУ ТЕСТІ'],
  'Cross out answer choices': ['Зачеркнуть варианты ответа', 'Жауап нұсқаларын сызып тастау'],
  'Answer choices': ['Варианты ответа', 'Жауап нұсқалары'],
  'Question {a} of {b}': ['Вопрос {a} из {b}', 'Сұрақ {a}/{b}'],
  'Back': ['Назад', 'Артқа'],
  'Scoring…': ['Проверяем…', 'Тексерілуде…'],
  'Finish': ['Завершить', 'Аяқтау'],
  'Close': ['Закрыть', 'Жабу'],
  'Answered': ['Отвечено', 'Жауап берілген'],
  'Unanswered': ['Без ответа', 'Жауап берілмеген'],
  'For review': ['На проверку', 'Қайта қарауға'],
  'Finish test ({a}/{b} answered)': ['Завершить тест (отвечено {a}/{b})', 'Тестті аяқтау ({a}/{b} жауап берілді)'],
  'All tests': ['Все тесты', 'Барлық тесттер'],
  'Review': ['Разбор', 'Талдау'],
  '{s} of {t} correct': ['{s} из {t} верно', '{s}/{t} дұрыс жауап'],
  'Question {n}': ['Вопрос {n}', '{n}-сұрақ'],
  'Correct': ['Верно', 'Дұрыс'],
  'Incorrect': ['Неверно', 'Қате'],
  'Skipped': ['Пропущен', 'Өткізіп жіберілген'],
}

type Vars = Record<string, string | number>

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  /** Translate an English UI string; `{name}` placeholders are filled from `vars`. */
  tr: (key: string, vars?: Vars) => string
  locale: string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const idx = lang === 'ru' ? 0 : 1
    return {
      lang,
      setLang,
      locale: LANGS.find((l) => l.code === lang)!.locale,
      tr: (key, vars) => {
        let s = lang === 'en' ? key : (D[key]?.[idx] ?? key)
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
        return s
      },
    }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n must be used inside I18nProvider')
  return v
}

/** Compact language buttons (EN / RU / KK) */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`inline-flex rounded-full bg-white/70 p-0.5 text-xs font-bold ring-1 ring-brand-100 ${className}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`rounded-full px-2.5 py-1.5 uppercase transition-colors ${lang === l.code ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'}`}
        >
          {l.code}
        </button>
      ))}
    </div>
  )
}
