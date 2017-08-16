module.exports = function() {

 return function(localStorageService) {
   var configManager = {};

   configManager.getPrivateToken = function() {
     return localStorageService.get('private_token');
   }

   configManager.setPrivateToken = function(privateToken) {
     localStorageService.set('private_token', privateToken);
   }

   configManager.getUrl = function() {
     return localStorageService.get('url');
   }

   configManager.setUrl = function(url) {
     localStorageService.set('url', url);
   }

   configManager.getRefreshRate = function() {
     return localStorageService.get('refresh_rate') || 5;
   }

   configManager.setRefreshRate = function(refreshRate) {
     localStorageService.set('refresh_rate', refreshRate);
   }

   configManager.displayBranchColumn = function() {
     return _.defaultTo(localStorageService.get('display_branch_column'), true);
   }

   configManager.setDisplayBranchColumn= function(displayBranchColumn) {
     localStorageService.set('display_branch_column', displayBranchColumn);
   }

   configManager.displayLabelsColumn = function() {
     return _.defaultTo(localStorageService.get('display_labels_column'), false);
   }

   configManager.setDisplayLabelsColumn = function(displayLabelsColumn) {
     localStorageService.set('display_labels_column', displayLabelsColumn);
   }

   configManager.clearCredentialsValues = function() {
     localStorageService.remove('url', 'private_token');
   }

   return configManager;
 }

};
