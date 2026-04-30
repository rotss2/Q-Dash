// Localization System for Q-Dash
// Supports multiple languages with fallback to English

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ar' | 'pt';

export interface Translations {
  // Common
  appName: string;
  loading: string;
  error: string;
  success: string;
  cancel: string;
  save: string;
  delete: string;
  edit: string;
  close: string;
  open: string;
  back: string;
  next: string;
  submit: string;
  required: string;
  optional: string;
  
  // Survey
  surveyTitle: string;
  surveyDescription: string;
  surveyClosed: string;
  surveyNotOpen: string;
  surveyExpired: string;
  startSurvey: string;
  completeSurvey: string;
  thankYou: string;
  responseRecorded: string;
  
  // Questions
  question: string;
  answer: string;
  textPlaceholder: string;
  choicePlaceholder: string;
  yes: string;
  no: string;
  agree: string;
  disagree: string;
  stronglyAgree: string;
  stronglyDisagree: string;
  neutral: string;
  
  // Errors
  errorLoadingSurvey: string;
  errorSubmitting: string;
  errorRequiredField: string;
  errorInvalidEmail: string;
  errorServer: string;
  errorNetwork: string;
  
  // Admin
  dashboard: string;
  newSurvey: string;
  editSurvey: string;
  analytics: string;
  responses: string;
  settings: string;
  languageSettings: string;
  themeSettings: string;
  branding: string;
  
  // Scheduling
  scheduling: string;
  openDate: string;
  closeDate: string;
  autoOpen: string;
  autoClose: string;
  timezoneNote: string;
}

const en: Translations = {
  appName: 'Q-Dash',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  close: 'Close',
  open: 'Open',
  back: 'Back',
  next: 'Next',
  submit: 'Submit',
  required: 'Required',
  optional: 'Optional',
  
  surveyTitle: 'Survey',
  surveyDescription: 'Description',
  surveyClosed: 'This survey is currently closed.',
  surveyNotOpen: 'This survey has not opened yet.',
  surveyExpired: 'This survey has ended.',
  startSurvey: 'Start Survey',
  completeSurvey: 'Complete Survey',
  thankYou: 'Thank You!',
  responseRecorded: 'Your response has been recorded.',
  
  question: 'Question',
  answer: 'Answer',
  textPlaceholder: 'Enter your answer...',
  choicePlaceholder: 'Select an option',
  yes: 'Yes',
  no: 'No',
  agree: 'Agree',
  disagree: 'Disagree',
  stronglyAgree: 'Strongly Agree',
  stronglyDisagree: 'Strongly Disagree',
  neutral: 'Neutral',
  
  errorLoadingSurvey: 'Failed to load survey. Please try again.',
  errorSubmitting: 'Failed to submit response. Please try again.',
  errorRequiredField: 'This field is required.',
  errorInvalidEmail: 'Please enter a valid email address.',
  errorServer: 'Server error. Please try again later.',
  errorNetwork: 'Network error. Please check your connection.',
  
  dashboard: 'Dashboard',
  newSurvey: 'New Survey',
  editSurvey: 'Edit Survey',
  analytics: 'Analytics',
  responses: 'Responses',
  settings: 'Settings',
  languageSettings: 'Language Settings',
  themeSettings: 'Theme Settings',
  branding: 'Branding',
  
  scheduling: 'Scheduling',
  openDate: 'Open Date',
  closeDate: 'Close Date',
  autoOpen: 'Automatically Open',
  autoClose: 'Automatically Close',
  timezoneNote: 'All times are in your local timezone.',
};

const es: Translations = {
  appName: 'Q-Dash',
  loading: 'Cargando...',
  error: 'Error',
  success: 'Éxito',
  cancel: 'Cancelar',
  save: 'Guardar',
  delete: 'Eliminar',
  edit: 'Editar',
  close: 'Cerrar',
  open: 'Abrir',
  back: 'Atrás',
  next: 'Siguiente',
  submit: 'Enviar',
  required: 'Requerido',
  optional: 'Opcional',
  
  surveyTitle: 'Encuesta',
  surveyDescription: 'Descripción',
  surveyClosed: 'Esta encuesta está cerrada.',
  surveyNotOpen: 'Esta encuesta aún no ha abierto.',
  surveyExpired: 'Esta encuesta ha terminado.',
  startSurvey: 'Comenzar Encuesta',
  completeSurvey: 'Completar Encuesta',
  thankYou: '¡Gracias!',
  responseRecorded: 'Tu respuesta ha sido registrada.',
  
  question: 'Pregunta',
  answer: 'Respuesta',
  textPlaceholder: 'Ingresa tu respuesta...',
  choicePlaceholder: 'Selecciona una opción',
  yes: 'Sí',
  no: 'No',
  agree: 'De acuerdo',
  disagree: 'En desacuerdo',
  stronglyAgree: 'Muy de acuerdo',
  stronglyDisagree: 'Muy en desacuerdo',
  neutral: 'Neutral',
  
  errorLoadingSurvey: 'Error al cargar la encuesta. Por favor, intenta de nuevo.',
  errorSubmitting: 'Error al enviar la respuesta. Por favor, intenta de nuevo.',
  errorRequiredField: 'Este campo es obligatorio.',
  errorInvalidEmail: 'Por favor, ingresa un correo válido.',
  errorServer: 'Error del servidor. Por favor, intenta más tarde.',
  errorNetwork: 'Error de red. Por favor, verifica tu conexión.',
  
  dashboard: 'Panel',
  newSurvey: 'Nueva Encuesta',
  editSurvey: 'Editar Encuesta',
  analytics: 'Análisis',
  responses: 'Respuestas',
  settings: 'Configuración',
  languageSettings: 'Configuración de Idioma',
  themeSettings: 'Configuración de Tema',
  branding: 'Marca',
  
  scheduling: 'Programación',
  openDate: 'Fecha de Apertura',
  closeDate: 'Fecha de Cierre',
  autoOpen: 'Apertura Automática',
  autoClose: 'Cierre Automático',
  timezoneNote: 'Todas las horas están en tu zona horaria local.',
};

const fr: Translations = {
  appName: 'Q-Dash',
  loading: 'Chargement...',
  error: 'Erreur',
  success: 'Succès',
  cancel: 'Annuler',
  save: 'Enregistrer',
  delete: 'Supprimer',
  edit: 'Modifier',
  close: 'Fermer',
  open: 'Ouvrir',
  back: 'Retour',
  next: 'Suivant',
  submit: 'Soumettre',
  required: 'Requis',
  optional: 'Optionnel',
  
  surveyTitle: 'Enquête',
  surveyDescription: 'Description',
  surveyClosed: 'Cette enquête est fermée.',
  surveyNotOpen: 'Cette enquête n\'est pas encore ouverte.',
  surveyExpired: 'Cette enquête est terminée.',
  startSurvey: 'Commencer l\'Enquête',
  completeSurvey: 'Compléter l\'Enquête',
  thankYou: 'Merci!',
  responseRecorded: 'Votre réponse a été enregistrée.',
  
  question: 'Question',
  answer: 'Réponse',
  textPlaceholder: 'Entrez votre réponse...',
  choicePlaceholder: 'Sélectionnez une option',
  yes: 'Oui',
  no: 'Non',
  agree: 'D\'accord',
  disagree: 'Pas d\'accord',
  stronglyAgree: 'Tout à fait d\'accord',
  stronglyDisagree: 'Pas du tout d\'accord',
  neutral: 'Neutre',
  
  errorLoadingSurvey: 'Erreur lors du chargement de l\'enquête. Veuillez réessayer.',
  errorSubmitting: 'Erreur lors de l\'envoi de la réponse. Veuillez réessayer.',
  errorRequiredField: 'Ce champ est obligatoire.',
  errorInvalidEmail: 'Veuillez entrer une adresse email valide.',
  errorServer: 'Erreur serveur. Veuillez réessayer plus tard.',
  errorNetwork: 'Erreur réseau. Veuillez vérifier votre connexion.',
  
  dashboard: 'Tableau de Bord',
  newSurvey: 'Nouvelle Enquête',
  editSurvey: 'Modifier l\'Enquête',
  analytics: 'Analyses',
  responses: 'Réponses',
  settings: 'Paramètres',
  languageSettings: 'Paramètres de Langue',
  themeSettings: 'Paramètres de Thème',
  branding: 'Marque',
  
  scheduling: 'Planification',
  openDate: 'Date d\'Ouverture',
  closeDate: 'Date de Fermeture',
  autoOpen: 'Ouverture Automatique',
  autoClose: 'Fermeture Automatique',
  timezoneNote: 'Toutes les heures sont dans votre fuseau horaire local.',
};

// Stub translations for not-yet-supported locales (fallback to English)
const de: Translations = { ...en };
const zh: Translations = { ...en };
const ja: Translations = { ...en };
const ar: Translations = { ...en };
const pt: Translations = { ...en };

// Translation dictionary
const translations: Record<Locale, Translations> = { en, es, fr, de, zh, ja, ar, pt };

// Default locale
export const DEFAULT_LOCALE: Locale = 'en';

// Supported locales
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'pt'];

// Get browser locale
export function getBrowserLocale(): Locale {
  const browserLang = navigator.language.split('-')[0];
  return SUPPORTED_LOCALES.includes(browserLang as Locale) 
    ? (browserLang as Locale) 
    : DEFAULT_LOCALE;
}

// Get translation for a key
export function t(key: keyof Translations, locale: Locale = DEFAULT_LOCALE): string {
  const currentTranslations = translations[locale] || translations[DEFAULT_LOCALE];
  return currentTranslations[key] || key;
}

// Get all translations for a locale
export function getTranslations(locale: Locale): Translations {
  return translations[locale] || translations[DEFAULT_LOCALE];
}

// Format date according to locale
export function formatDate(date: string | Date, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get locale name for display
export function getLocaleDisplayName(locale: Locale): string {
  const names: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    zh: '中文',
    ja: '日本語',
    ar: 'العربية',
    pt: 'Português',
  };
  return names[locale] || locale;
}
