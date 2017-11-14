module.exports = function(localStorageService) {
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
    var value = localStorageService.get('display_branch_column');
    return value !== null ? value : true;
  }

  configManager.setDisplayBranchColumn= function(displayBranchColumn) {
    localStorageService.set('display_branch_column', displayBranchColumn);
  }

  configManager.displayLabelsColumn = function() {
    var value = localStorageService.get('display_labels_column');
    return value !== null ? value : false;
  }

  configManager.setDisplayLabelsColumn = function(displayLabelsColumn) {
    localStorageService.set('display_labels_column', displayLabelsColumn);
  }

  configManager.clearCredentialsValues = function() {
    localStorageService.remove('url', 'private_token');
  }

  return configManager;
};
