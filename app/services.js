"use strict";

angular.module('app')

.service('configManager', function(localStorageService) {
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
    return localStorageService.get('display_branch_column') || true;
  }

  configManager.setDisplayBranchColumn= function(displayBranchColumn) {
    localStorageService.set('display_branch_column', displayBranchColumn);
  }

  configManager.clearCredentialsValues = function() {
    localStorageService.remove('url', 'private_token');
  }

  return configManager;
})

.service('gitLabManager', function(configManager, $http, $q) {
  var gitLabManager = {};

  gitLabManager.getUser = function() {
    var deferred = $q.defer();

    if (!gitLabManager.hasCredentials()) {
      deferred.reject("Url and/or private token are missing");
    } else {
      $http({
        url: configManager.getUrl() + '/api/v3/user',
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

.service('MergeRequestFetcher', function (gitLabManager, configManager, favicoService, $q, $http) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};

  var authenticatedUser = null;

  var updateFavico = function() {
    favicoService.badge(Object.keys(MergeRequestFetcher.mergeRequests).length);
  };

  var request = function (url) {
    return $http({
      url: configManager.getUrl() + '/api/v3' + url,
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
    var url = '/projects/' + mergeRequest.project.id + '/merge_requests/' + mergeRequest.id + '/award_emoji?per_page=100';
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
        url: mergeRequest.web_url + '/builds'
      };
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
});
