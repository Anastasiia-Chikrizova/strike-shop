import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const REDIS_URL = process.env.REDIS_URL

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
