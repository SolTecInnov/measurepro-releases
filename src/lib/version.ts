import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const BUILD_DATE = new Date().toISOString().split('T')[0];
export const APP_NAME = 'MeasurePRO';
export const COMPANY_NAME = 'Soltec Innovation';
export const COMPANY_URL = 'https://soltecinnovation.com';
export const SUPPORT_EMAIL = 'support@soltecinnovation.com';
