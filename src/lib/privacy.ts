import type { Lang } from './i18n'

export interface PolicySection {
  h: string
  p?: string[]
  ul?: string[]
}

export interface Policy {
  title: string
  updatedLabel: string
  updated: string
  sections: PolicySection[]
}

// Text supplied by the site owner (EN / RU / KK). **double asterisks** mark bold text.
export const privacy: Record<Lang, Policy> = {
  en: {
    title: 'Privacy Policy',
    updatedLabel: 'Last Updated:',
    updated: 'November 13, 2026',
    sections: [
      {
        h: '1. Introduction',
        p: ['Welcome to PeaklyPrep ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy applies to all information collected through our website, peaklyprep.vercel.app.'],
      },
      {
        h: '2. Information We Collect',
        p: ['We collect personal information that you voluntarily provide to us when you register on the website, express an interest in obtaining information about us or our products and services, or otherwise when you contact us. This may include:'],
        ul: ['Names', 'Email addresses', 'Passwords (encrypted)'],
      },
      {
        h: '3. Payment Information and Lemon Squeezy',
        p: [
          "We use Lemon Squeezy as our Merchant of Record and payment processor. All payment transactions are handled by Lemon Squeezy. **We do not process, record, or maintain your credit card or bank account information.** For more information on how Lemon Squeezy processes your data, please review Lemon Squeezy's Privacy Policy at https://www.lemonsqueezy.com/privacy.",
        ],
      },
      {
        h: '4. How We Use Your Information',
        p: ['We use the information we collect or receive to:'],
        ul: ['Facilitate account creation and logon process.', 'Provide and manage your access to our SAT preparation courses.', 'Send administrative information to you (e.g., product updates, changes to our terms).'],
      },
      {
        h: '5. How We Share Your Information',
        p: ['We only share information with Lemon Squeezy to process your payments and manage your subscriptions. We do not sell, rent, or trade your personal information to third parties.'],
      },
      {
        h: '6. Contact Us',
        p: ['If you have questions or comments about this notice, you may email us at support@peaklyprep.com.'],
      },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updatedLabel: 'Последнее обновление:',
    updated: '13 ноября 2026 г.',
    sections: [
      {
        h: '1. Введение',
        p: ['Добро пожаловать на PeaklyPrep («мы», «наш» или «нас»). Мы стремимся защищать вашу личную информацию и ваше право на конфиденциальность. Данная Политика конфиденциальности применяется ко всей информации, собранной через наш веб-сайт peaklyprep.vercel.app.'],
      },
      {
        h: '2. Какую информацию мы собираем',
        p: ['Мы собираем личную информацию, которую вы добровольно предоставляете нам при регистрации на веб-сайте, выражении заинтересованности в получении информации о нас или наших услугах, а также при обращении к нам. Это может включать:'],
        ul: ['Имя', 'Адрес электронной почты', 'Пароли (в зашифрованном виде)'],
      },
      {
        h: '3. Платежная информация и Lemon Squeezy',
        p: [
          'Мы используем Lemon Squeezy в качестве нашего официального продавца (Merchant of Record) и платежного шлюза. Все платежные транзакции обрабатываются Lemon Squeezy. **Мы не обрабатываем, не записываем и не храним данные вашей кредитной карты или банковского счета.** Для получения дополнительной информации о том, как Lemon Squeezy обрабатывает ваши данные, ознакомьтесь с Политикой конфиденциальности Lemon Squeezy по адресу https://www.lemonsqueezy.com/privacy.',
        ],
      },
      {
        h: '4. Как мы используем вашу информацию',
        p: ['Мы используем собранную информацию для:'],
        ul: ['Обеспечения процесса создания аккаунта и входа в систему.', 'Предоставления вам доступа к нашим курсам подготовки к SAT.', 'Отправки вам административной информации (например, обновлений продукта, изменений в наших условиях).'],
      },
      {
        h: '5. Как мы делимся вашей информацией',
        p: ['Мы передаем информацию только сервису Lemon Squeezy для обработки ваших платежей и управления подписками. Мы не продаем, не сдаем в аренду и не передаем вашу личную информацию третьим лицам.'],
      },
      {
        h: '6. Свяжитесь с нами',
        p: ['Если у вас есть вопросы или комментарии по поводу этой политики, вы можете написать нам по адресу support@peaklyprep.com.'],
      },
    ],
  },
  kk: {
    title: 'Құпиялылық саясаты',
    updatedLabel: 'Соңғы жаңартылуы:',
    updated: '13 қараша 2026 ж.',
    sections: [
      {
        h: '1. Кіріспе',
        p: ['PeaklyPrep сайтына қош келдіңіз («біз» немесе «біздің»). Біз сіздің жеке ақпаратыңызды және құпиялылық құқығыңызды қорғауға міндеттенеміз. Осы Құпиялылық саясаты біздің peaklyprep.vercel.app веб-сайтымыз арқылы жиналған барлық ақпаратқа қолданылады.'],
      },
      {
        h: '2. Біз жинайтын ақпарат',
        p: ['Біз сіздің веб-сайтта тіркелу кезінде, біз немесе біздің қызметтеріміз туралы ақпарат алуға қызығушылық танытқан кезде немесе бізбен байланысқан кезде өз еркіңізбен ұсынған жеке ақпаратыңызды жинаймыз. Бұған мыналар кіруі мүмкін:'],
        ul: ['Аты-жөні', 'Электрондық пошта мекенжайы', 'Құпия сөздер (шифрланған түрде)'],
      },
      {
        h: '3. Төлем ақпараты және Lemon Squeezy',
        p: [
          'Біз Lemon Squeezy сервисін ресми сатушы (Merchant of Record) және төлемді өңдеуші ретінде қолданамыз. Барлық төлем транзакцияларын Lemon Squeezy жүзеге асырады. **Біз сіздің несие картаңыздың немесе банк шотыңыздың деректерін өңдемейміз, жазбаймыз және сақтамаймыз.** Lemon Squeezy сіздің деректеріңізді қалай өңдейтіні туралы қосымша ақпарат алу үшін https://www.lemonsqueezy.com/privacy мекенжайы бойынша Lemon Squeezy Құпиялылық саясатымен танысыңыз.',
        ],
      },
      {
        h: '4. Ақпаратыңызды қалай қолданамыз',
        p: ['Біз жиналған ақпаратты келесі мақсаттарда қолданамыз:'],
        ul: ['Аккаунт құру және жүйеге кіру процесін қамтамасыз ету.', 'SAT дайындық курстарына қол жеткізуді қамтамасыз ету және басқару.', 'Сізге әкімшілік ақпаратты (мысалы, өнім жаңартулары, шарттарымыздағы өзгерістер) жіберу.'],
      },
      {
        h: '5. Ақпаратыңызбен бөлісу',
        p: ['Біз сіздің төлемдеріңізді өңдеу және жазылымдарыңызды басқару үшін ақпаратты тек Lemon Squeezy сервисіне береміз. Біз сіздің жеке ақпаратыңызды үшінші тараптарға сатпаймыз, жалға бермейміз немесе бөліспейміз.'],
      },
      {
        h: '6. Бізбен байланыс',
        p: ['Егер осы саясатқа қатысты сұрақтарыңыз немесе пікірлеріңіз болса, бізге support@peaklyprep.com мекенжайына жаза аласыз.'],
      },
    ],
  },
}
