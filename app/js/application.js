var angular = require('angular');

var emojify = require('emojify.js');
var _ = require('lodash');

angular.module('app', [require('angular-tooltips'), require('angular-route'), require('angular-local-storage'), require('angular-moment')])

.config(['$routeProvider', 'localStorageServiceProvider', function($routeProvider, localStorageServiceProvider) {
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
}])

.filter('length', function() {
  return function(collection) {
    return _.size(collection);
  }
})

.filter('emojify', ['$sce', function($sce) {
  return function (input) {
        if (!input)
            return "";

        return $sce.trustAsHtml(emojify.replace(input));
    };
}])

.service('configManager', ['localStorageService', require('./services/config_manager')])
.service('gitLabManager', ['configManager', '$http', '$q', require('./services/gitlab_manager')])
.service('favicoService', require('./services/favico'))
.service('MergeRequestFetcher', ['gitLabManager', 'configManager', 'favicoService', '$q', '$http', require('./services/merge_request_fetcher')])

.controller('DashboardCtrl', ['$interval', 'MergeRequestFetcher', 'configManager', require('./controllers/dashboard')])
.controller('SettingsCtrl', ['gitLabManager', 'configManager', '$location', 'MergeRequestFetcher', require('./controllers/settings')])

.run(['$rootScope', 'gitLabManager', '$location', '$http', function($rootScope, gitLabManager, $location, $http) {
  $rootScope.titleAddon = '';

  // This events gets triggered on refresh or URL change
  $rootScope.$on('$locationChangeStart', function() {
    if (!gitLabManager.hasCredentials()) {
      $location.path('/settings');
    }
  });

}]);
