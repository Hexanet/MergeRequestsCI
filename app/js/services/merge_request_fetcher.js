var _ = require('lodash');

module.exports = function (gitLabManager, configManager, favicoService, $q, $http) {
  var MergeRequestFetcher = {};
  MergeRequestFetcher.mergeRequests = {};
  MergeRequestFetcher.labels = {};

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

  var getMergeRequests = function() {
    var url = '/merge_requests?state=opened&scope=all';
    return request(url).then(function(response) {
      var mergeRequests = response.data;

      return $q.all([
        mergeRequests.map(addProjectToMergeRequest),
        mergeRequests.map(addVotesToMergeRequest),
        mergeRequests.map(addCiStatusToMergeRequest),
        mergeRequests.map(formatLabelsForMergeRequest)
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

  var addProjectToMergeRequest = function(mergeRequest) {
    var url = '/projects/' + mergeRequest.project_id;
    return request(url).then(function(response) {
      var project = response.data;
      mergeRequest.project = {};
      mergeRequest.project.name = project.name_with_namespace;
      mergeRequest.project.web_url = project.web_url;
    });
  };


  var addVotesToMergeRequest = function(mergeRequest) {
    if (mergeRequest.upvotes === 0 && mergeRequest.downvotes === 0) {
      return;
    }

    var url = '/projects/' + mergeRequest.project_id + '/merge_requests/' + mergeRequest.iid + '/award_emoji?per_page=100';
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
    var url = '/projects/' + mergeRequest.project_id + '/repository/commits/' + encodeURIComponent(mergeRequest.source_branch);
    return request(url).then(function(response) {
      var commit = response.data;

      mergeRequest.ci = {
        status: commit.status === "not_found" ? null : commit.status,
        url: mergeRequest.web_url + '/pipelines'
      };
    });
  };

  var formatLabelsForMergeRequest = function(mergeRequest) {
    if (MergeRequestFetcher.labels[mergeRequest.project_id] !== undefined) {
      mergeRequest.formatted_labels = [];
      mergeRequest.labels.forEach(function(label) {
        mergeRequest.formatted_labels.push(MergeRequestFetcher.labels[mergeRequest.project_id][label]);
      });
    }

    var url = '/projects/' + mergeRequest.project_id + '/labels';
    return request(url).then(function(response) {
      MergeRequestFetcher.labels[mergeRequest.project_id] = {};
      response.data.forEach(function(label) {
        MergeRequestFetcher.labels[mergeRequest.project_id][label.name] = label;
      });

      mergeRequest.formatted_labels = [];
      mergeRequest.labels.forEach(function(label) {
        mergeRequest.formatted_labels.push(MergeRequestFetcher.labels[mergeRequest.project_id][label]);
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

  gitLabManager.getUser().then(function(user) {
    authenticatedUser = user;
  });

  MergeRequestFetcher.refresh = function () {
    cleanMergeRequests();

    getMergeRequests().then(function(mergeRequests) {
      mergeRequests.forEach(function (mergeRequest) {
        MergeRequestFetcher.mergeRequests[mergeRequest.iid] = mergeRequest;
        updateFavico();
      });
    });
  };

  return MergeRequestFetcher;
};
