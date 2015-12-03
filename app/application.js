"use strict";

angular.module('app', ['config.api'])

.provider('PullFetcher', function (apiConfig) {
  var baseUrl = apiConfig.base_url;
  var privateToken = apiConfig.private_token;

  this.$get = ['$http', '$q', function ($http, $q) {

    var pullFetcher = {
      pulls: {},
      refreshPulls: function () {
        var self = this;

        getRepos(baseUrl);

      }
    };

    var request = function (url) {
      return $http({
        url: url,
        headers: {'PRIVATE-TOKEN': privateToken}
      });
    };



    var getRepoPulls = function (url, repo) {
      return request(url + '/projects/' + repo.id + '/merge_requests?state=opened')
        .then(function (response) {
          return response.data;
        });
    };

    var getRepos = function (url, page) {
      if (page === undefined) {
        page = 1;
      }
      request(url + '/projects?per_page=100&page=' + page)
        .then(function (response) {
          var projects = response.data.filter(function(project) {
              return project.merge_requests_enabled && !project.archived;
          });

          projects.forEach(function (repo) {
            getRepoPulls(url, repo).then(function (pulls) {
              pulls.forEach(function (pull) {
                pull.project = {};
                pull.project.name = repo.name;
                pull.project.web_url = repo.web_url;
                pullFetcher.pulls[pull.id] = pull;
              });
            });
          });
          if (response.data.length) {
            getRepos(url, page + 1);
          }
        });
    };

    return pullFetcher;
  }];
})

.controller('MainCtrl', function ($interval, PullFetcher) {
  this.mergeRequests = PullFetcher.pulls;

  var polling = $interval(function () {
    PullFetcher.refreshPulls();
  }, 5 * 60 * 1000);

  PullFetcher.refreshPulls();
});
