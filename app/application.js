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
    .when('/settings', {
      templateUrl: 'settings.html',
      controller: 'SettingsCtrl',
      controllerAs: 'vm'
    })
    .otherwise({
      redirectTo: '/'
    });
})

.service('gitLabManager', function(localStorageService, $http, $q) {
  var gitLabManager = {};

  gitLabManager.getPrivateToken = function() {
    return localStorageService.get('private_token');
  }

  gitLabManager.getUrl = function() {
    return localStorageService.get('url');
  }

  gitLabManager.getRefreshRate = function() {
    return localStorageService.get('refresh_rate');
  }

  gitLabManager.setRefreshRate = function(refreshRate) {
    localStorageService.set('refresh_rate', refreshRate);
  }

  gitLabManager.getUser = function() {
    return $http({
      url: gitLabManager.getUrl() + '/api/v3/user',
      headers:  {'PRIVATE-TOKEN': this.getPrivateToken()}
    }).then(function(response) {
      return response.data;
    });
  }

  gitLabManager.isAuthentificated = function() {
    return gitLabManager.getUrl() && gitLabManager.getPrivateToken();
  }

  gitLabManager.authenticate = function(url, privateToken) {
    localStorageService.set('url', url);
    localStorageService.set('private_token', privateToken);

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
    localStorageService.remove('url');
    localStorageService.remove('private_token');
  }

  return gitLabManager;
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

.service('MergeRequestFetcher', function (gitLabManager, favicoService, $q, $http) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};

  var authenticatedUser = null;

  var updateFavico = function() {
    favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
  };

  var request = function (url) {
    return $http({
      url: gitLabManager.getUrl() + '/api/v3' + url,
      headers:  {'PRIVATE-TOKEN': gitLabManager.getPrivateToken()}
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
      });

      return $q.all([
        mergeRequests.map(addVotesToMergeRequest),
        mergeRequests.map(addCiStatusToMergeRequest)
      ]).then(function() {
        return mergeRequests;
      });
    });
  };

  var getMergeRequest = function(projectId, mergeRequestId) {
    var url = '/projects/' + projectId + '/merge_request/' + mergeRequestId;
    return request(url).then(function(response) {
      return response.data;
    });
  };

  var addVotesToMergeRequest = function(mergeRequest) {
    var url = '/projects/' + mergeRequest.project.id + '/merge_requests/' + mergeRequest.id + '/notes?per_page=100';
    return request(url).then(function(response) {
      var notes = response.data;

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
    });
  };

  var addCiStatusToMergeRequest = function(mergeRequest) {
    var url = '/projects/' + mergeRequest.project.id + '/repository/commits/' + encodeURIComponent(mergeRequest.source_branch);
    return request(url).then(function(response) {
      var commit = response.data;

      mergeRequest.ci = {
        status: commit.status == "not_found" ? null : commit.status
      };

      return commit.status == "not_found" ? [] : addCiUrlToMergeRequest(mergeRequest, commit);
    });
  };

  var addCiUrlToMergeRequest = function(mergeRequest, commit) {
    var url = '/projects/' + mergeRequest.project.id + '/repository/commits/' + commit.id + '/statuses';
    return request(url).then(function(response) {
      var commitStatus = response.data;
      commitStatus = _.head(commitStatus);

      if(commitStatus) {
        mergeRequest.ci.url = commitStatus.target_url;
      }
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
            MergeRequestFetcher.mergeRequests[mergeRequest.id] = mergeRequest;
            updateFavico();
          });
        });
      });
    });
  };

  return MergeRequestFetcher;
})

.controller('DashboardCtrl', function ($interval, MergeRequestFetcher, gitLabManager) {
  var vm = this;
  vm.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refresh();
  }, gitLabManager.getRefreshRate() * 60 * 1000);

  vm.refresh = function() {
    MergeRequestFetcher.refresh();
  };

  MergeRequestFetcher.refresh();
})

.controller('SettingsCtrl', function (gitLabManager, $location) {
  var vm = this;
  vm.error = false;
  vm.config = {
    url: gitLabManager.getUrl(),
    private_token: gitLabManager.getPrivateToken(),
    refresh_rate: gitLabManager.getRefreshRate() || 5
  };

  vm.save = function(config) {
    gitLabManager.authenticate(
      config.url,
      config.private_token
    ).then(function success() {
      gitLabManager.setRefreshRate(config.refresh_rate);
      $location.path("/");
    }, function failure() {
      vm.error = true;
    });

  }
})

.filter('length', function() {
  return function(collection) {
    return _.size(collection);
  }
})

.run(function($rootScope, gitLabManager, $location, $http) {

  // This events gets triggered on refresh or URL change
  $rootScope.$on('$locationChangeStart', function() {
    if (!gitLabManager.isAuthentificated()) {
      $location.path('/settings');
    }
  });

});
