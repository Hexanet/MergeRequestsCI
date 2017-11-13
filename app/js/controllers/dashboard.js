module.exports = function ($interval, MergeRequestFetcher, configManager, favicoService) {
  var vm = this;
  vm.refresh = function() {
    MergeRequestFetcher.getMergeRequests().then(function(mergeRequests) {
      vm.mergeRequests = mergeRequests;
      favicoService.badge(mergeRequests.length);
    });
  };

  $interval(function () {
    vm.refresh();
  }, configManager.getRefreshRate() * 60 * 1000);

  vm.displayBranchColumn = configManager.displayBranchColumn();
  vm.displayLabelsColumn = configManager.displayLabelsColumn();

  vm.refresh();
};
