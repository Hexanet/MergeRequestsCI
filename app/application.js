"use strict";

angular.module('app', ['config.app', 'emojify', '720kb.tooltips'])

.config(function($httpProvider, appConfig) {
  $httpProvider.defaults.headers.common = {
    'PRIVATE-TOKEN': appConfig.token
  };
})

.service('favicoService', function() {
  var favico = new Favico({
    animation : 'fade'
  });

  this.badge = function(num) {
    favico.badge(num);
  };

  this.reset = function() {
    favico.reset();
  };
})

.service('gitlabService', function($q, $http, appConfig) {
  this.getProjects = function() {
    var deferred = $q.defer();
    var projects = [];

    function loadProjects(page) {
      $http
        .get(appConfig.apiUrl + '/projects?order_by=last_activity_at&per_page=100&page=' + page)
        .then(function(response) {
          projects = _.union(projects, response.data);

          response.data.length ? loadProjects(++page) : deferred.resolve(projects);
       });
    }

    loadProjects(1);

    return deferred.promise;
  };

  this.getMergeRequests = function(projectId) {
    return $http.get(appConfig.apiUrl + '/projects/' + projectId + '/merge_requests?state=opened').then(function(response) {
      return response.data;
    });
  };

  this.getMergeRequest = function(projectId, mergeRequestId) {
    return $http.get(appConfig.apiUrl + '/projects/' + projectId + '/merge_request/' + mergeRequestId).then(function(response) {
      return response.data;
    });
  };

  this.getNotes = function(projectId, mergeRequestId) {
    return $http.get(appConfig.apiUrl + '/projects/' + projectId + '/merge_requests/' + mergeRequestId + '/notes?per_page=100').then(function(response) {
      return response.data;
    });
  };

  this.getCommit = function(projectId, branch) {
    return $http.get(appConfig.apiUrl + '/projects/' + projectId + '/repository/commits/' + branch).then(function(response) {
      return response.data;
    });
  };

  this.getCommitStatus = function(projectId, commitSha) {
    return $http.get(appConfig.apiUrl + '/projects/' + projectId + '/repository/commits/' + commitSha + '/statuses').then(function(response) {
      return response.data;
    });
    };
})

.service('MergeRequestFetcher', function (gitlabService, favicoService) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};

  var updateFavico = function() {
    favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
  };

  var cleanMergeRequests = function() {
    angular.forEach(MergeRequestFetcher.mergeRequests, function(mergeRequest, id) {
      gitlabService.getMergeRequest(mergeRequest.project_id, id).then(function(mergeRequestData) {
        if (mergeRequestData.state === 'closed' || mergeRequestData.state === 'merged') {
          delete MergeRequestFetcher.mergeRequests[id];
          updateFavico();
        }
      });
    });
  };

  MergeRequestFetcher.refresh = function () {
    cleanMergeRequests();

    gitlabService.getProjects().then(function(projects) {
      projects = projects.filter(function(project) {
          return project.merge_requests_enabled && !project.archived;
      });

      projects.forEach(function (project) {
        gitlabService.getMergeRequests(project.id).then(function (mergeRequests) {
          mergeRequests.forEach(function (mergeRequest) {
            mergeRequest.project = {};
            mergeRequest.project.name = project.name;
            mergeRequest.project.web_url = project.web_url;
            mergeRequest.web_url = project.web_url + '/merge_requests/' + mergeRequest.iid;

            gitlabService
              .getNotes(project.id, mergeRequest.id)
              .then(function(notes) {
                var lastNote =  _.last(notes);
                mergeRequest.lastActivity = lastNote ? lastNote.created_at : mergeRequest.updated_at;

                mergeRequest.upvoters = [];
                mergeRequest.downvoters = [];
                notes.forEach(function (note) {
                    if (note.upvote) {
                        mergeRequest.upvoters.push(note.author.name);
                    }

                    if (note.downvote) {
                        mergeRequest.downvoters.push(note.author.name);
                    }
                });

                return gitlabService.getCommit(project.id, mergeRequest.source_branch);
              }).then(function(commit) {
                mergeRequest.ci = {
                  status: commit.status == "not_found" ? null : commit.status
                };

                return commit.status == "not_found" ? [] : gitlabService.getCommitStatus(project.id, commit.id)
              }).then(function(commitStatus) {
                commitStatus = _.head(commitStatus);

                if(commitStatus) {
                  mergeRequest.ci.url = commitStatus.target_url;
                }

                MergeRequestFetcher.mergeRequests[mergeRequest.id] = mergeRequest;
                updateFavico();
              });
          });
        });
      });

    });
  };

  return MergeRequestFetcher;
})

.controller('MainCtrl', function ($interval, MergeRequestFetcher, appConfig) {
  var vm = this;
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  }, appConfig.refreshInterval * 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  };

  MergeRequestFetcher.refresh();
  vm.lastRefresh = new Date();
})

.filter('length', function() {
  return function(collection) {
    return _.size(collection);
  }
});
