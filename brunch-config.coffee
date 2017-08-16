module.exports = config:
  modules:
    autoRequire:
      'app.js': ['initialize']
  files:
    javascripts: joinTo:
      'app.js': /^app/
      'vendor.js': /^(?!app)/
    stylesheets: joinTo: 'app.css'
  plugins:
    assetsmanager:
      copyTo:
        'images/emoji': ['node_modules/emojify.js/dist/images/basic/*']
    sass:
      options:
        includePaths: ['node_modules/foundation-sites/scss']
