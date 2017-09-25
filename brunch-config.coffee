module.exports = config:
  server:
    port: 3000
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
        includePaths: [
          'node_modules/foundation-sites/scss',
          'node_modules/angular-tooltips/lib'
        ]
