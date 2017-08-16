module.exports = function() {

 return function (gitLabManager, configManager, favicoService, $q, $http) {
   var MergeRequestFetcher = {};
   MergeRequestFetcher.mergeRequests = {};

   var authenticatedUser = null;

   var updateFavico = function() {
     favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
   };

   var request = function (url) {
     return $http({
       url: configManager.getUrl() + '/api/v4' + url,
       headers:  {'PRIVATE-TOKEN': configManager.getPrivateToken()}
     });
   };

   var getProjects = function() {
     var deferred = $q.defer();
     var projects = [];

     function loadProjects(page) {
       var url = '/projects?order_by=last_activity_at&per_page=100&page=' + page;
       request(url)
         .then(function(response) {
           projects = _.union(projects, response.data);

           response.data.length ? loadProjects(++page) : deferred.resolve(projects);
        });
     }

     loadProjects(1);

     return deferred.promise;
   };

   var getMergeRequests = function(project) {
     var url = '/projects/' + project.id + '/merge_requests?state=opened';
     return request(url).then(function(response) {
       var mergeRequests = response.data;

       mergeRequests.map(function(mergeRequest) {
         mergeRequest.project = {};
         mergeRequest.project.id = project.id;
         mergeRequest.project.name = project.name_with_namespace;
         mergeRequest.project.web_url = project.web_url;
         mergeRequest.web_url = project.web_url + '/merge_requests/' + mergeRequest.iid;
         mergeRequest.lastActivity = mergeRequest.updated_at;
       });

       return $q.all([
         mergeRequests.map(addVotesToMergeRequest),
         mergeRequests.map(addCiStatusToMergeRequest),
         formatLabelsForMergeRequests(project, mergeRequests)
       ]).then(function() {
         return mergeRequests;
       });
     });
   };

   var getMergeRequest = function(projectId, mergeRequestId) {
     var url = '/projects/' + projectId + '/merge_requests/' + mergeRequestId;
     return request(url).then(function(response) {
       return response.data;
     });
   };

   var addVotesToMergeRequest = function(mergeRequest) {
     var url = '/projects/' + mergeRequest.project.id + '/merge_requests/' + mergeRequest.iid + '/award_emoji?per_page=100';
     return request(url).then(function(response) {
       var awards = response.data;

       mergeRequest.upvoters = [];
       mergeRequest.downvoters = [];
       mergeRequest.i_have_voted = 0;
       awards.forEach(function (award) {

           if (award.name === 'thumbsup') {
               mergeRequest.upvoters.push(award.user.name);

               if (award.user.id === authenticatedUser.id) {
                   mergeRequest.i_have_voted = 1;
               }
           }

           if (award.name === 'thumbsdown') {
               mergeRequest.downvoters.push(award.user.name);

               if (award.user.id === authenticatedUser.id) {
                   mergeRequest.i_have_voted = -1;
               }
           }
       });
     });
   };

   var addCiStatusToMergeRequest = function(mergeRequest) {
     var url = '/projects/' + mergeRequest.project.id + '/repository/commits/' + encodeURIComponent(mergeRequest.source_branch);
     return request(url).then(function(response) {
       var commit = response.data;

       mergeRequest.ci = {
         status: commit.status == "not_found" ? null : commit.status,
         url: mergeRequest.web_url + '/pipelines'
       };
     });
   };

   var formatLabelsForMergeRequests = function(project, mergeRequests) {
     if (mergeRequests.length === 0) {
       return;
     }

     var url = '/projects/' + project.id + '/labels';
     return request(url).then(function(response) {
         var labels = {};

         response.data.forEach(function(label) {
           labels[label.name] = label;
         });

         mergeRequests.map(function(mergeRequest) {
           var mergeRequestLabels = mergeRequest.labels;
           mergeRequest.labels = [];
           mergeRequestLabels.forEach(function(label) {
             mergeRequest.labels.push(labels[label]);
           });
         });
     });
   };

   var cleanMergeRequests = function() {
     angular.forEach(MergeRequestFetcher.mergeRequests, function(mergeRequest, id) {
       getMergeRequest(mergeRequest.project_id, id).then(function(mergeRequestData) {
         if (mergeRequestData.state === 'closed' || mergeRequestData.state === 'merged') {
           delete MergeRequestFetcher.mergeRequests[id];
           updateFavico();
         }
       });
     });
   };

   var filterProjects = function(project) {
     return project.merge_requests_enabled && !project.archived;
   };

   gitLabManager.getUser().then(function(user) {
       authenticatedUser = user;
   });

   MergeRequestFetcher.refresh = function () {
     cleanMergeRequests();

     getProjects().then(function(projects) {
       projects = projects.filter(filterProjects);

       projects.forEach(function (project) {
         getMergeRequests(project).then(function (mergeRequests) {
           mergeRequests.forEach(function (mergeRequest) {
             MergeRequestFetcher.mergeRequests[mergeRequest.iid] = mergeRequest;
             updateFavico();
           });
         });
       });
     });
   };

   return MergeRequestFetcher;
 }

};
