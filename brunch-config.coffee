module.exports = config:
  modules:
    definition: false
    wrapper: false
  files:
    javascripts: joinTo:
      'vendor.js': /^(?!^(app))/
      'app.js': /^app/
    stylesheets: joinTo: 'app.css'
