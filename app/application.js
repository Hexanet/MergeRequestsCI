"use strict";

angular.module('app', ['emojify', '720kb.tooltips', 'ngRoute', 'LocalStorageModule', 'angularMoment'])

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

.run(function($rootScope, gitLabManager, $location, $http) {
  $rootScope.titleAddon = '';

  // This events gets triggered on refresh or URL change
  $rootScope.$on('$locationChangeStart', function() {
    if (!gitLabManager.hasCredentials()) {
      $location.path('/settings');
    }
  });

});
