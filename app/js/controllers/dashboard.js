module.exports = function ($interval, MergeRequestFetcher, configManager) {
  var vm = this;

  MergeRequestFetcher.refresh();

  vm.displayBranchColumn = configManager.displayBranchColumn();
  vm.displayLabelsColumn = configManager.displayLabelsColumn();
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
    vm.mergeRequests = MergeRequestFetcher.mergeRequests;
  }, configManager.getRefreshRate() * 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
  };

};
