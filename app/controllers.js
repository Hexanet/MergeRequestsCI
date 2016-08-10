"use strict";

angular.module('app')

.controller('DashboardCtrl', function ($interval, MergeRequestFetcher, configManager) {
  var vm = this;
  vm.displayBranchColumn = configManager.displayBranchColumn();
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
  }, configManager.getRefreshRate() * 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
  };

  MergeRequestFetcher.refresh();
})

.controller('SettingsCtrl', function (gitLabManager, configManager, $location, MergeRequestFetcher) {
  var vm = this;
  vm.error = false;
  vm.config = {
    url: configManager.getUrl(),
    private_token: configManager.getPrivateToken(),
    refresh_rate: configManager.getRefreshRate(),
    display_branch_column: configManager.displayBranchColumn()
  };

  vm.save = function(config) {
    gitLabManager.authenticate(
      config.url,
      config.private_token
    ).then(function success() {
      configManager.setRefreshRate(config.refresh_rate);
      configManager.setDisplayBranchColumn(config.display_branch_column);
      MergeRequestFetcher.mergeRequests = {};
      $location.path("/");
    }, function failure() {
      vm.error = true;
    });

  }
});
