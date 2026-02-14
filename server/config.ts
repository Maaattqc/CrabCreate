import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export interface BitbucketConfig {
  username: string;
  appPassword: string;
  workspace: string;
  defaultRepo: string;
}

export interface Config {
  port: number;
  nodeEnv: string;
  clientUrl: string;
  dbPath: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  bitbucket: BitbucketConfig;
  reposClonePath: string;
  dbDocsPath: string;
  stagingBaseUrl: string;
  ngrokUrl: string;
  jwtSecret: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  adminEmail: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  dbPath: process.env.DB_PATH || path.join(__dirname, 'db', 'kanban.db'),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  bitbucket: {
    username: process.env.BITBUCKET_USERNAME || '',
    appPassword: process.env.BITBUCKET_APP_PASSWORD || '',
    workspace: process.env.BITBUCKET_WORKSPACE || '',
    defaultRepo: process.env.BITBUCKET_DEFAULT_REPO || '',
  },
  reposClonePath: process.env.REPOS_CLONE_PATH || path.join(__dirname, '..', 'repos'),
  dbDocsPath: process.env.DB_DOCS_PATH || path.join(__dirname, '..', 'db-docs'),
  stagingBaseUrl: process.env.STAGING_BASE_URL || '',
  ngrokUrl: process.env.NGROK_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

export default config;
