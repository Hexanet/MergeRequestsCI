module.exports = function (gitLabManager, configManager, $location, MergeRequestFetcher) {
  var vm = this;
  vm.error = false;
  vm.config = {
    url: configManager.getUrl(),
    private_token: configManager.getPrivateToken(),
    refresh_rate: configManager.getRefreshRate(),
    display_branch_column: configManager.displayBranchColumn(),
    display_labels_column: configManager.displayLabelsColumn()
  };

  vm.save = function(config) {
    gitLabManager.authenticate(
      config.url,
      config.private_token
    ).then(function success() {
      configManager.setRefreshRate(config.refresh_rate);
      configManager.setDisplayBranchColumn(config.display_branch_column);
      configManager.setDisplayLabelsColumn(config.display_labels_column);
      MergeRequestFetcher.mergeRequests = {};
      $location.path("/");
    }, function failure() {
      vm.error = true;
    });

  }
};
