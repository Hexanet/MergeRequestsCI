"use strict";

angular.module('app', ['config.api'])

.factory('favicoService', function() {
    var favico = new Favico({
        animation : 'fade'
    });

    var badge = function(num) {
        favico.badge(num);
    };
    var reset = function() {
        favico.reset();
    };

    return {
        badge : badge,
        reset : reset
    };
})

.factory('gitlabService', function($q, $http, apiConfig) {
  return {
    getProjects: function() {
      var deferred = $q.defer();
      var projects = [];

      function loadProjects(page) {
        $http.get(apiConfig.base_url + '/projects?per_page=100&page=' + page)
         .then(function(response) {
              projects = _.union(projects, response.data);

              if(response.data.length) {
                 loadProjects(++page);
              }
              else {
                 deferred.resolve(projects);
              }
         })
      }

      loadProjects(1);

      return deferred.promise;
    },
    getMergeRequests: function(projectId) {
       return $http.get(apiConfig.base_url + '/projects/' + projectId + '/merge_requests?state=opened').then(function(response) {
         return response.data;
       });
    },
    getMergeRequest: function(projectId, mergeRequestId) {
       return $http.get(apiConfig.base_url + '/projects/' + projectId + '/merge_request/' + mergeRequestId).then(function(response) {
         return response.data;
       });
    },
    getMergeRequestVotes: function(projectId, mergeRequestId) {
      return $http.get(apiConfig.base_url + '/projects/' + projectId + '/merge_request/' + mergeRequestId + '/comments?per_page=100').then(function(response) {
        var votes = {
          'up': 0,
          'down': 0
        };

        response.data.forEach(function(comment) {
            if(comment.note == '+1') {
              votes.up++;
            }
            else if(comment.note == '-1') {
              votes.down++;
            }
        });

        return votes;
      });
    },
    getCommit: function(projectId, branch) {
      return $http.get(apiConfig.base_url + '/projects/' + projectId + '/repository/commits/' + branch).then(function(response) {
        return response.data;
      });
    }
  }
})

.service('MergeRequestFetcher', function (gitlabService, favicoService) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};

  var updateFavico = function() {
    favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
  };

  var removeClosedMergeRequests = function() {
    angular.forEach(MergeRequestFetcher.mergeRequests, function(mergeRequest, id) {
      gitlabService.getMergeRequest(mergeRequest.project_id, id).then(function(mergeRequestData) {
        if (mergeRequestData.state === 'closed') {
          delete MergeRequestFetcher.mergeRequests[id];
          updateFavico();
        }
      });
    });
  }

  MergeRequestFetcher.refresh = function () {
    removeClosedMergeRequests();

    gitlabService.getProjects().then(function(projects) {
      projects = projects.filter(function(project) {
          return project.merge_requests_enabled && !project.archived;
      });

      projects.forEach(function (project) {
        gitlabService.getMergeRequests(project.id).then(function (mergeRequests) {
          mergeRequests.forEach(function (mergeRequest) {
            gitlabService.getMergeRequestVotes(project.id, mergeRequest.id).then(function(votes) {
              mergeRequest.project = {};
              mergeRequest.project.name = project.name;
              mergeRequest.project.web_url = project.web_url;
              mergeRequest.web_url = project.web_url + '/merge_requests/' + mergeRequest.iid;
              mergeRequest.votes = votes;

              gitlabService.getCommit(project.id, mergeRequest.source_branch).then(function(commit) {
                mergeRequest.ci = commit.status;

                MergeRequestFetcher.mergeRequests[mergeRequest.id] = mergeRequest;
                updateFavico();
              });
            });
          });
        });
      });

    });
  };

  return MergeRequestFetcher;
})

.controller('MainCtrl', function ($interval, MergeRequestFetcher) {
  var vm = this;
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  }, 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  };

  MergeRequestFetcher.refresh();
  vm.lastRefresh = new Date();
})

.run(function($http, apiConfig) {
  $http.defaults.headers.common = {
    'PRIVATE-TOKEN': apiConfig.private_token
  };
});
