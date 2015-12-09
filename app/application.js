"use strict";

angular.module('app', ['config.api'])

.provider('MergeRequestFetcher', function (apiConfig) {
  var baseUrl = apiConfig.base_url;
  var privateToken = apiConfig.private_token;

  var favicon = new Favico({
      animation : 'fade'
  });
  favicon.badge(0);

  this.$get = ['$http', '$q', function ($http, $q) {

    var mergeRequestFetcher = {
      mergeRequests: {},
      refreshMergeRequests: function () {
        var self = this;

        getProjects(baseUrl);
      }
    };

    var request = function (url) {
      return $http({
        url: url,
        headers: {'PRIVATE-TOKEN': privateToken}
      });
    };

    var getProjectRequests = function (url, repo) {
      return request(url + '/projects/' + repo.id + '/merge_requests?state=opened')
        .then(function (response) {
          return response.data;
        });
    };

    var getMergeRequest = function (url, project, mergeRequest) {
      return request(url + '/projects/' + project.id + '/merge_request/' + mergeRequest.id)
        .then(function (response) {
          return response.data;
        });
    };

    var getVotes = function(url, project, mergeRequest) {
      return request(url + '/projects/' + project.id + '/merge_request/' + mergeRequest.id + '/comments?per_page=100')
        .then(function (response) {
          var upvotes = 0;
          var downvotes = 0;

          response.data.forEach(function(comment) {
              if(comment.note == '+1') {
                upvotes++;
              }
              else if(comment.note == '-1') {
                downvotes++;
              }
          });

          return {
            'up': upvotes,
            'down': downvotes
          };
        });
    }

    var getProjects = function (url, page) {
      if (page === undefined) {
        page = 1;
      }
      request(url + '/projects?per_page=100&page=' + page)
        .then(function (response) {
          var projects = response.data.filter(function(project) {
              return project.merge_requests_enabled && !project.archived;
          });

          projects.forEach(function (repo) {
            getProjectRequests(url, repo).then(function (mergeRequests) {
              mergeRequests.forEach(function (mergeRequest) {
                getVotes(url, repo, mergeRequest).then(function(votes) {
                  mergeRequest.project = {};
                  mergeRequest.project.name = repo.name;
                  mergeRequest.project.web_url = repo.web_url;
                  mergeRequest.web_url = repo.web_url + '/merge_requests/' + mergeRequest.iid;
                  mergeRequest.votes = votes;
                  mergeRequestFetcher.mergeRequests[mergeRequest.id] = mergeRequest;

                  favicon.badge(Object.keys(mergeRequestFetcher.mergeRequests).length);
                });
              });
            });
          });

          if (response.data.length) {
            getProjects(url, page + 1);
          }
        });
    };

    return mergeRequestFetcher;
  }];
})

.controller('MainCtrl', function ($interval, MergeRequestFetcher) {
  this.mergeRequests = MergeRequestFetcher.mergeRequests;

  var polling = $interval(function () {
    MergeRequestFetcher.refreshMergeRequests();
  }, 5 * 60 * 1000);

  MergeRequestFetcher.refreshMergeRequests();
});
