module.exports = function() {

 return function(configManager, $http, $q) {
   var gitLabManager = {};

   gitLabManager.getUser = function() {
     var deferred = $q.defer();

     if (!gitLabManager.hasCredentials()) {
       deferred.reject("Url and/or private token are missing");
     } else {
       $http({
         url: configManager.getUrl() + '/api/v4/user',
         headers:  {'PRIVATE-TOKEN': configManager.getPrivateToken()}
       }).then(function(response) {
         deferred.resolve(response.data);
       }, function(msg) {
         deferred.reject(msg);
       });
     }

     return deferred.promise;
   }

   gitLabManager.hasCredentials = function() {
     return configManager.getUrl() && configManager.getPrivateToken();
   }

   gitLabManager.authenticate = function(url, privateToken) {
     configManager.setUrl(url);
     configManager.setPrivateToken(privateToken);

     var deferred = $q.defer();

     gitLabManager.getUser().then(function(user) {
       deferred.resolve(user);
     }, function() {
       gitLabManager.logout();
       deferred.reject('Unauthorized');
     });

     return deferred.promise;
   }

   gitLabManager.logout = function() {
     configManager.clearCredentialsValues();
   }

   return gitLabManager;
 }

};
