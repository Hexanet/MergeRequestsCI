var angular = require('angular');

var emojify = require('emojify.js');
var _ = require('lodash');

angular.module('app', [require('angular-tooltips'), require('angular-route'), require('angular-local-storage'), require('angular-moment')])

.config(function($routeProvider, localStorageServiceProvider) {
  localStorageServiceProvider
    .setPrefix('merge-requests-ci');

  $routeProvider
    .when('/', {
      templateUrl: 'dashboard.html',
      controller: 'DashboardCtrl',
      controllerAs: 'vm'
    })
    .when('/settings', {
      templateUrl: 'settings.html',
      controller: 'SettingsCtrl',
      controllerAs: 'vm'
    })
    .otherwise({
      redirectTo: '/'
    });
})

.filter('length', function() {
  return function(collection) {
    return _.size(collection);
  }
})

.filter('emojify', function($sce) {
  return function (input) {
        if (!input)
            return "";

        return $sce.trustAsHtml(emojify.replace(input));
    };
})

.service('configManager', require('./services/config_manager'))
.service('gitLabManager', require('./services/gitlab_manager'))
.service('favicoService', require('./services/favico'))
.service('MergeRequestFetcher', require('./services/merge_request_fetcher'))

.controller('DashboardCtrl', require('./controllers/dashboard'))
.controller('SettingsCtrl', require('./controllers/settings'))

.run(function($rootScope, gitLabManager, $location, $http) {
  $rootScope.titleAddon = '';

  // This events gets triggered on refresh or URL change
  $rootScope.$on('$locationChangeStart', function() {
    if (!gitLabManager.hasCredentials()) {
      $location.path('/settings');
    }
  });

});
