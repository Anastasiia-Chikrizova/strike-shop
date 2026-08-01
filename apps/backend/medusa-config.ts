import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const REDIS_URL = process.env.REDIS_URL

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
const R2_ENABLED = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL)

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    ...(REDIS_URL
      ? [
          {
            resolve: '@medusajs/medusa/cache-redis',
            options: { redisUrl: REDIS_URL },
          },
          {
            resolve: '@medusajs/medusa/event-bus-redis',
            options: { redisUrl: REDIS_URL },
          },
          {
            resolve: '@medusajs/medusa/workflow-engine-redis',
            options: { redis: { url: REDIS_URL } },
          },
        ]
      : []),
    ...(R2_ENABLED
      ? [
          {
            resolve: '@medusajs/medusa/file',
            options: {
              providers: [
                {
                  resolve: '@medusajs/medusa/file-s3',
                  id: 's3',
                  options: {
                    file_url: R2_PUBLIC_URL,
                    access_key_id: R2_ACCESS_KEY_ID,
                    secret_access_key: R2_SECRET_ACCESS_KEY,
                    region: 'auto',
                    bucket: R2_BUCKET,
                    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                    additional_client_config: {
                      forcePathStyle: true,
                    },
                    acl: false,
                  },
                },
              ],
            },
          },
        ]
      : []),
    { resolve: './src/modules/monobank' },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            // Ідентифікатор провайдера в Medusa: pp_monobank_monobank
            resolve: './src/modules/monobank-payment',
            id: 'monobank',
            options: {
              apiKey: process.env.MONO_KEY,
              apiUrl: process.env.MONO_API_URL,
              // "debit" — кошти списуються одразу, "hold" — блокуються до capture
              paymentType: process.env.MONO_PAYMENT_TYPE ?? 'debit',
              redirectUrl: process.env.MONO_REDIRECT_URL,
              webhookUrl: process.env.MONO_WEBHOOK_URL,
            },
          },
        ],
      },
    },
  ]
})
