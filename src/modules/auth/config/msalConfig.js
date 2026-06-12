import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node';
import axios from 'axios';
import logger from '../../../shared/utils/logger.js';

// Custom HTTP client using axios to avoid Railway network issues with MSAL's built-in HttpClient
const axiosNetworkClient = {
  sendGetRequestAsync: async (url, options) => {
    try {
      const response = await axios.get(url, {
        headers: options?.headers || {},
        timeout: 15000,
        validateStatus: () => true,
      });
      return { headers: response.headers, body: response.data, status: response.status };
    } catch (err) {
      logger.error('MSAL GET request failed:', { url: url.split('?')[0], error: err.message, code: err.code });
      throw err;
    }
  },
  sendPostRequestAsync: async (url, options) => {
    try {
      const response = await axios.post(url, options?.body, {
        headers: options?.headers || {},
        timeout: 15000,
        validateStatus: () => true,
      });
      return { headers: response.headers, body: response.data, status: response.status };
    } catch (err) {
      logger.error('MSAL POST request failed:', { url: url.split('?')[0], error: err.message, code: err.code });
      throw err;
    }
  },
};

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
  system: {
    networkClient: axiosNetworkClient,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii && (level === LogLevel.Error || level === LogLevel.Warning)) {
          logger.warn(`MSAL [${level}]: ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Warning,
    },
  },
};

const msalInstance = new ConfidentialClientApplication(msalConfig);

export { msalInstance, msalConfig };

export default {
  msalInstance,
  msalConfig
};
