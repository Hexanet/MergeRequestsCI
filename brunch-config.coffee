module.exports = config:
  npm:
    enabled: false
  modules:
    definition: false
    wrapper: false
  files:
    javascripts: joinTo:
      'vendor.js': /^(?!^(app))/
      'app.js': /^app/
    stylesheets: joinTo: 'app.css'
  plugins:
    assetsmanager:
      copyTo:
        'images/emoji': ['bower_components/emojify.js/dist/images/basic/*']
