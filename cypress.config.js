module.exports = {
  allowCypressEnv: false,
  projectId: "zkqiu1",

  e2e: {
    baseUrl: 'https://pp.yc.mechta.kz',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 2560,
    viewportHeight: 1440,
    defaultCommandTimeout: 40000,
    responseTimeout: 40000,

    setupNodeEvents(on, config) {
      return config
    },
  },
}