import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'chpli2-language';
export const LANGUAGE_CHANGED_EVENT = 'chpli2-language-changed';
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en', 'de'] as const;

const resources = {
  'zh-CN': {
    translation: {
      'nav.home': '首页',
      'nav.travel': '行程',
      'nav.calendar': '日历',
      'language.label': '语言',
      'home.welcome': '欢迎使用 CHPLI',
      'home.hint': '从左侧导航选择一个模块开始使用。',
      'common.loading': '加载中…',
      'auth.title': '登录 CHPLI',
      'auth.loginTab': '登录',
      'auth.registerTab': '注册',
      'auth.username': '用户名',
      'auth.identifier': '用户名 / 邮箱 / 手机',
      'auth.loginModeLabel': '登录方式',
      'auth.loginModePassword': '密码登录',
      'auth.loginModeCode': '验证码登录',
      'auth.password': '密码',
      'auth.code': '验证码',
      'auth.sendCode': '发送验证码',
      'auth.resendAfter': '{{seconds}} 秒后重发',
      'auth.codeSent': '验证码已发送，10 分钟内有效',
      'auth.codeMaybeSent': '如果该邮箱/手机已注册，验证码将很快送达',
      'auth.email': '邮箱（可选）',
      'auth.phone': '手机（可选）',
      'auth.submitLogin': '登录',
      'auth.submitRegister': '注册',
      'auth.loggingIn': '请稍候…',
      'auth.logout': '登出',
      'portal.backHome': '返回首页',
      'portal.waitingLogin': '等待 Portal 登录…',
      'auth.welcome': '你好，{{username}}',
      'auth.error.USERNAME_TAKEN': '用户名已被占用',
      'auth.error.EMAIL_TAKEN': '该邮箱已被其他账号绑定',
      'auth.error.PHONE_TAKEN': '该手机已被其他账号绑定',
      'auth.error.INVALID_CREDENTIALS': '账号或密码错误',
      'auth.error.INVALID_CODE': '验证码错误或已过期',
      'auth.error.CODE_COOLDOWN': '请求太频繁，请稍后再试',
      'auth.error.UNAUTHORIZED': '登录已过期，请重新登录',
      'auth.error.VALIDATION_ERROR': '输入格式不正确',
      'auth.error.UNKNOWN': '出错了，请稍后重试',
      'loadError.title': '模块加载失败',
      'loadError.message':
        '无法加载 {{module}} 模块。请确认对应服务已启动（{{url}}）后点击重试。',
      'loadError.retry': '重试',
    },
  },
  en: {
    translation: {
      'nav.home': 'Home',
      'nav.travel': 'Travel',
      'nav.calendar': 'Calendar',
      'language.label': 'Language',
      'home.welcome': 'Welcome to CHPLI',
      'home.hint': 'Choose a module from the navigation to get started.',
      'common.loading': 'Loading…',
      'auth.title': 'Sign in to CHPLI',
      'auth.loginTab': 'Sign in',
      'auth.registerTab': 'Register',
      'auth.username': 'Username',
      'auth.identifier': 'Username / email / phone',
      'auth.loginModeLabel': 'Sign-in method',
      'auth.loginModePassword': 'Password',
      'auth.loginModeCode': 'Verification code',
      'auth.password': 'Password',
      'auth.code': 'Code',
      'auth.sendCode': 'Send code',
      'auth.resendAfter': 'Resend in {{seconds}}s',
      'auth.codeSent': 'Code sent; valid for 10 minutes',
      'auth.codeMaybeSent': 'If this email/phone is registered, a code is on its way',
      'auth.email': 'Email (optional)',
      'auth.phone': 'Phone (optional)',
      'auth.submitLogin': 'Sign in',
      'auth.submitRegister': 'Create account',
      'auth.loggingIn': 'Please wait…',
      'auth.logout': 'Sign out',
      'portal.backHome': 'Back to home',
      'portal.waitingLogin': 'Waiting for Portal sign-in…',
      'auth.welcome': 'Hello, {{username}}',
      'auth.error.USERNAME_TAKEN': 'This username is already taken',
      'auth.error.EMAIL_TAKEN': 'This email is already bound to another account',
      'auth.error.PHONE_TAKEN': 'This phone is already bound to another account',
      'auth.error.INVALID_CREDENTIALS': 'Invalid account or password',
      'auth.error.INVALID_CODE': 'Invalid or expired code',
      'auth.error.CODE_COOLDOWN': 'Too frequent; please retry later',
      'auth.error.UNAUTHORIZED': 'Your session expired; please sign in again',
      'auth.error.VALIDATION_ERROR': 'The input format is invalid',
      'auth.error.UNKNOWN': 'Something went wrong; please retry later',
      'loadError.title': 'Module failed to load',
      'loadError.message':
        'Could not load the {{module}} module. Make sure its dev server is running ({{url}}) and retry.',
      'loadError.retry': 'Retry',
    },
  },
  de: {
    translation: {
      'nav.home': 'Startseite',
      'nav.travel': 'Reisen',
      'nav.calendar': 'Kalender',
      'language.label': 'Sprache',
      'home.welcome': 'Willkommen bei CHPLI',
      'home.hint': 'Wähle ein Modul in der Navigation, um loszulegen.',
      'common.loading': 'Wird geladen…',
      'auth.title': 'Bei CHPLI anmelden',
      'auth.loginTab': 'Anmelden',
      'auth.registerTab': 'Registrieren',
      'auth.username': 'Benutzername',
      'auth.identifier': 'Benutzername / E-Mail / Telefon',
      'auth.loginModeLabel': 'Anmeldemethode',
      'auth.loginModePassword': 'Passwort',
      'auth.loginModeCode': 'Bestätigungscode',
      'auth.password': 'Passwort',
      'auth.code': 'Code',
      'auth.sendCode': 'Code senden',
      'auth.resendAfter': 'Erneut in {{seconds}}s',
      'auth.codeSent': 'Code gesendet, 10 Minuten gültig',
      'auth.codeMaybeSent': 'Wenn diese E-Mail/dieses Telefon registriert ist, ist der Code unterwegs',
      'auth.email': 'E-Mail (optional)',
      'auth.phone': 'Telefon (optional)',
      'auth.submitLogin': 'Anmelden',
      'auth.submitRegister': 'Konto erstellen',
      'auth.loggingIn': 'Bitte warten…',
      'auth.logout': 'Abmelden',
      'portal.backHome': 'Zur Startseite',
      'portal.waitingLogin': 'Warten auf Portal-Anmeldung…',
      'auth.welcome': 'Hallo, {{username}}',
      'auth.error.USERNAME_TAKEN': 'Dieser Benutzername ist bereits vergeben',
      'auth.error.EMAIL_TAKEN': 'Diese E-Mail ist bereits an ein anderes Konto gebunden',
      'auth.error.PHONE_TAKEN': 'Diese Telefonnummer ist bereits an ein anderes Konto gebunden',
      'auth.error.INVALID_CREDENTIALS': 'Ungültiges Konto oder Passwort',
      'auth.error.INVALID_CODE': 'Ungültiger oder abgelaufener Code',
      'auth.error.CODE_COOLDOWN': 'Zu häufig; bitte später erneut versuchen',
      'auth.error.UNAUTHORIZED': 'Deine Sitzung ist abgelaufen; bitte erneut anmelden',
      'auth.error.VALIDATION_ERROR': 'Das Eingabeformat ist ungültig',
      'auth.error.UNKNOWN': 'Etwas ist schiefgelaufen; bitte später erneut versuchen',
      'loadError.title': 'Modul konnte nicht geladen werden',
      'loadError.message':
        'Das Modul {{module}} konnte nicht geladen werden. Stelle sicher, dass sein Entwicklungsserver läuft ({{url}}), und versuche es erneut.',
      'loadError.retry': 'Erneut versuchen',
    },
  },
};

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored;
    }
  } catch {
    /* localStorage may be unavailable; fall through to default */
  }
  return 'zh-CN';
}

const instance = i18n.createInstance();

void instance.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof window !== 'undefined') {
  window.addEventListener(LANGUAGE_CHANGED_EVENT, (event) => {
    const language = (event as CustomEvent<{ language: string }>).detail?.language;
    if (language && language !== instance.language) {
      void instance.changeLanguage(language);
    }
  });
  window.addEventListener('storage', (event) => {
    if (
      event.key === LANGUAGE_STORAGE_KEY &&
      event.newValue &&
      event.newValue !== instance.language
    ) {
      void instance.changeLanguage(event.newValue);
    }
  });
}

export default instance;
