module.exports = function() {

 return function ($interval, MergeRequestFetcher, configManager) {
   var vm = this;
   vm.displayBranchColumn = configManager.displayBranchColumn();
   vm.displayLabelsColumn = configManager.displayLabelsColumn();
   vm.mergeRequests = MergeRequestFetcher.mergeRequests;

   var polling = $interval(function () {
     MergeRequestFetcher.refresh();
   }, configManager.getRefreshRate() * 60 * 1000);

   vm.refresh = function() {
     MergeRequestFetcher.refresh();
   };

   MergeRequestFetcher.refresh();
 };

};
