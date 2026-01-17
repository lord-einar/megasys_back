// src/modules/auth/config/msalConfig.js
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (process.env.NODE_ENV === 'development') {
          // console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 'Info',
    },
  },
};

const msalInstance = new ConfidentialClientApplication(msalConfig);

export { msalInstance, msalConfig };

export default {
  msalInstance,
  msalConfig
};