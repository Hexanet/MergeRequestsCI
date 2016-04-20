"use strict";

angular.module('app', ['config.app', 'emojify', '720kb.tooltips', 'ngRoute', 'LocalStorageModule', 'angularMoment'])

.config(function($routeProvider, localStorageServiceProvider) {
  localStorageServiceProvider
    .setPrefix('merge-requests-ci');

  $routeProvider
    .when('/', {
      templateUrl: 'dashboard.html',
      controller: 'DashboardCtrl',
      controllerAs: 'vm'
    })
    .when('/login', {
      templateUrl: 'login.html',
      controller: 'LoginCtrl',
      controllerAs: 'vm'
    })
    .otherwise({
      redirectTo: '/'
    });
})

.service('authentificationService', function(localStorageService) {

  this.getPrivateToken = function() {
    return localStorageService.get('private_token');
  }

  this.getApiUrl = function() {
    return localStorageService.get('api_url');
  }

  this.isAuthentificated = function() {
    return this.getApiUrl() && this.getPrivateToken();
  }

  this.authenticate = function(apiUrl, privateToken) {
    localStorageService.set('api_url', apiUrl);
    localStorageService.set('private_token', privateToken);
  }

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

.service('gitlabService', function($q, $http, authentificationService) {
  this.getProjects = function() {
    var deferred = $q.defer();
    var projects = [];

    function loadProjects(page) {
      $http
        .get(authentificationService.getApiUrl() + '/projects?order_by=last_activity_at&per_page=100&page=' + page)
        .then(function(response) {
          projects = _.union(projects, response.data);

          response.data.length ? loadProjects(++page) : deferred.resolve(projects);
       });
    }

    loadProjects(1);

    return deferred.promise;
  };

  this.getUser = function(projectId) {
    return $http.get(authentificationService.getApiUrl() + '/user').then(function(response) {
      return response.data;
    });
  };

  this.getMergeRequests = function(projectId) {
    return $http.get(authentificationService.getApiUrl() + '/projects/' + projectId + '/merge_requests?state=opened').then(function(response) {
      return response.data;
    });
  };

  this.getMergeRequest = function(projectId, mergeRequestId) {
    return $http.get(authentificationService.getApiUrl() + '/projects/' + projectId + '/merge_request/' + mergeRequestId).then(function(response) {
      return response.data;
    });
  };

  this.getNotes = function(projectId, mergeRequestId) {
    return $http.get(authentificationService.getApiUrl() + '/projects/' + projectId + '/merge_requests/' + mergeRequestId + '/notes?per_page=100').then(function(response) {
      return response.data;
    });
  };

  this.getCommit = function(projectId, branch) {
    return $http.get(authentificationService.getApiUrl() + '/projects/' + projectId + '/repository/commits/' + encodeURIComponent(branch)).then(function(response) {
      return response.data;
    });
  };

  this.getCommitStatus = function(projectId, commitSha) {
    return $http.get(authentificationService.getApiUrl() + '/projects/' + projectId + '/repository/commits/' + commitSha + '/statuses').then(function(response) {
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

  var user = null;
  gitlabService.getUser().then(function(userData) {
    user = userData;
  });

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
            mergeRequest.project.name = project.name_with_namespace;
            mergeRequest.project.web_url = project.web_url;
            mergeRequest.web_url = project.web_url + '/merge_requests/' + mergeRequest.iid;

            gitlabService
              .getNotes(project.id, mergeRequest.id)
              .then(function(notes) {
                var lastNote =  _.last(notes);
                mergeRequest.lastActivity = lastNote ? lastNote.created_at : mergeRequest.updated_at;

                mergeRequest.upvoters = [];
                mergeRequest.downvoters = [];
                mergeRequest.i_have_voted = 0;
                notes.forEach(function (note) {
                    if (note.upvote) {
                        mergeRequest.upvoters.push(note.author.name);

                        if (note.author.id === user.id) {
                            mergeRequest.i_have_voted = 1;
                        }
                    }

                    if (note.downvote) {
                        mergeRequest.downvoters.push(note.author.name);

                        if (note.author.id === user.id) {
                            mergeRequest.i_have_voted = -1;
                        }
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

.controller('DashboardCtrl', function ($interval, MergeRequestFetcher, $http, localStorageService) {
  var vm = this;
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  }, 5 * 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
    vm.lastRefresh = new Date();
  };

  MergeRequestFetcher.refresh();
  vm.lastRefresh = new Date();
})

.controller('LoginCtrl', function (authentificationService, $location) {
  var vm = this;

  vm.login = function(config) {
    authentificationService.authenticate(config.api_url, config.private_token);
    $location.path("/");
  }
})

.filter('length', function() {
  return function(collection) {
    return _.size(collection);
  }
})


.run(function($rootScope, authentificationService, $location, $http) {

  // This events gets triggered on refresh or URL change
  $rootScope.$on('$locationChangeStart', function() {
    if (authentificationService.isAuthentificated()) {
      $http.defaults.headers.common = {
        'PRIVATE-TOKEN': authentificationService.getPrivateToken()
      };
    } else {
      $location.path('/login');
    }
  });

});
