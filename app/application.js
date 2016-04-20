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

.service('authentificationService', function(localStorageService, $http, $q) {
  var authentificationService = {};

  authentificationService.getPrivateToken = function() {
    return localStorageService.get('private_token');
  }

  authentificationService.getApiUrl = function() {
    return localStorageService.get('api_url');
  }

  authentificationService.getUser = function() {
    return $http({
      url: authentificationService.getApiUrl() + '/user',
      headers:  {'PRIVATE-TOKEN': this.getPrivateToken()}
    }).then(function(response) {
      return response.data;
    });
  }

  authentificationService.isAuthentificated = function() {
    return authentificationService.getApiUrl() && authentificationService.getPrivateToken();
  }

  authentificationService.authenticate = function(apiUrl, privateToken) {
    localStorageService.set('api_url', apiUrl);
    localStorageService.set('private_token', privateToken);

    var deferred = $q.defer();

    authentificationService.getUser().then(function(user) {
      deferred.resolve(user);
    }, function() {
      authentificationService.logout();
      deferred.reject('Unauthorized');
    });

    return deferred.promise;
  }

  authentificationService.logout = function() {
    localStorageService.remove('api_url');
    localStorageService.remove('private_token');
  }

  return authentificationService;
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

.service('MergeRequestFetcher', function (authentificationService, favicoService, $q, $http) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};

  var authenticatedUser = null;

  var updateFavico = function() {
    favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
  };

  var request = function (url) {
    return $http({
      url: authentificationService.getApiUrl() + url,
      headers:  {'PRIVATE-TOKEN': authentificationService.getPrivateToken()}
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

  var getMergeRequests = function(projectId) {
    var url = '/projects/' + projectId + '/merge_requests?state=opened';
    return request(url).then(function(response) {
      return response.data;
    });
  };

  var getMergeRequest = function(projectId, mergeRequestId) {
    var url = '/projects/' + projectId + '/merge_request/' + mergeRequestId;
    return request(url).then(function(response) {
      return response.data;
    });
  };

  var getNotes = function(projectId, mergeRequestId) {
    var url = '/projects/' + projectId + '/merge_requests/' + mergeRequestId + '/notes?per_page=100';
    return request(url).then(function(response) {
      return response.data;
    });
  };

  var getCommit = function(projectId, branch) {
    var url = '/projects/' + projectId + '/repository/commits/' + encodeURIComponent(branch);
    return request(url).then(function(response) {
      return response.data;
    });
  };

  var getCommitStatus = function(projectId, commitSha) {
    var url = '/projects/' + projectId + '/repository/commits/' + commitSha + '/statuses';
    return request(url).then(function(response) {
      return response.data;
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

  authentificationService.getUser().then(function(user) {
      authenticatedUser = user;
  });

  MergeRequestFetcher.refresh = function () {
    cleanMergeRequests();

    getProjects().then(function(projects) {
      projects = projects.filter(function(project) {
          return project.merge_requests_enabled && !project.archived;
      });

      projects.forEach(function (project) {
        getMergeRequests(project.id).then(function (mergeRequests) {
          mergeRequests.forEach(function (mergeRequest) {
            mergeRequest.project = {};
            mergeRequest.project.name = project.name_with_namespace;
            mergeRequest.project.web_url = project.web_url;
            mergeRequest.web_url = project.web_url + '/merge_requests/' + mergeRequest.iid;

            getNotes(project.id, mergeRequest.id)
              .then(function(notes) {
                var lastNote =  _.last(notes);
                mergeRequest.lastActivity = lastNote ? lastNote.created_at : mergeRequest.updated_at;

                mergeRequest.upvoters = [];
                mergeRequest.downvoters = [];
                mergeRequest.i_have_voted = 0;
                notes.forEach(function (note) {
                    if (note.upvote) {
                        mergeRequest.upvoters.push(note.author.name);

                        if (note.author.id === authenticatedUser.id) {
                            mergeRequest.i_have_voted = 1;
                        }
                    }

                    if (note.downvote) {
                        mergeRequest.downvoters.push(note.author.name);

                        if (note.author.id === authenticatedUser.id) {
                            mergeRequest.i_have_voted = -1;
                        }
                    }
                });

                return getCommit(project.id, mergeRequest.source_branch);
              }).then(function(commit) {
                mergeRequest.ci = {
                  status: commit.status == "not_found" ? null : commit.status
                };

                return commit.status == "not_found" ? [] : getCommitStatus(project.id, commit.id)
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

.controller('DashboardCtrl', function ($interval, MergeRequestFetcher) {
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
    if (!authentificationService.isAuthentificated()) {
      $location.path('/login');
    }
  });

});
