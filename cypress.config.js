module.exports = {
  allowCypressEnv: false,

  e2e: {
    baseUrl: 'https://pp.yc.mechta.kz',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1188,
    viewportHeight: 889,
    setupNodeEvents(on, config) {
      // Игнорирование определённых внешних запросов в логах
      const blockedUrls = [
        'https://www.google.com/*',
        'https://www.facebook.com/**',
        'https://ad.doubleclick.net/**',
        'https://analytics.google.com/*',
        'https://privacy-cs.mail.ru/*',
        'https://mc.yandex.ru/*',
        'https://ams.creativecdn.com/*',
        'https://api.iconify.design/**',
      ]

      on('task', {
        ignoreRequest(url) {
          return blockedUrls.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return regex.test(url)
          })
        },
      })

      return config
    },
  },
}