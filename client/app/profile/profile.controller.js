(function () {

    'use strict';

    /**
     * Profile controller which manages the user profiles
     */
    angular
        .module('taskingManager')
        .controller('profileController', ['$routeParams', '$location', '$window', 'NgTableParams', 'accountService','authService','mapService', 'projectService', 'projectMapService','userService', 'taskService', 'geospatialService', 'messageService','settingsService', profileController]);

    function profileController($routeParams, $location, $window, NgTableParams, accountService, authService, mapService, projectService, projectMapService, userService, taskService, geospatialService, messageService, settingsService) {

        var vm = this;
        vm.username = '';
        vm.currentlyLoggedInUser = null;
        vm.userDetails = null;
        vm.userStats = null;
        vm.osmUserDetails = null;
        vm.projects = [];
        vm.map = null;
        vm.highlightSource = null;
        vm.savingExpertMode = false;

        // Errors - for displaying messages when API calls were not successful
        vm.errorSetRole = false;
        vm.errorSetLevel = false;
        vm.errorSetExpertMode = false;
        vm.errorSetContactDetails = false;
        vm.errorVerificationEmailSent = false;

        // For showing the user a message when the verification email was sent
        // which only happens when the user has entered a new email address or
        // pressed the resent verification email button
        vm.verificationEmailSent = false;

        // User details
        vm.contactDetailsForm = {};
        vm.editDetails = false;

        // mapper levels
        vm.mapperLevelIntermediate = 0;
        vm.mapperLevelAdvanced = 0;

        // Invalidated tasks tables
        vm.mapperClosedFilterOptions = [
          {title: 'All', id: ''},
          {title: 'Open', id: false},
          {title: 'Closed', id: true},
        ];
        vm.validatorClosedFilterOptions = vm.mapperClosedFilterOptions.slice(0); // clone
        vm.invalidatedTasksAsMapperTableSettings = invalidatedTaskTableSettings(false);
        vm.invalidatedTasksAsValidatorTableSettings = invalidatedTaskTableSettings(true);

        activate();

        function activate() {
            vm.username = $routeParams.id;
            setUserDetails();
            mapService.createOSMMap('map');
            vm.map = mapService.getOSMMap();
            projectMapService.initialise(vm.map);
            var hoverIdentify = true;
            var clickIdentify = true;
            projectMapService.addPopupOverlay(hoverIdentify, clickIdentify);
            getLevelSettings();
            getUserStats();
            getUserProjects();
        }

        function invalidatedTaskTableSettings(asValidator) {
            return new NgTableParams({
                sorting: {updatedDate: "desc"},
                filter: {closed: false},
                count: 10,
            }, {
                counts: [10, 25, 50, 100],
                getData: function(params) {
                    var sortBy = Object.keys(params.sorting())[0]
                    return taskService.getUserInvalidatedTasks(
                        asValidator,
                        vm.username,
                        params.page(),
                        params.count(),
                        sortBy,
                        sortBy ? params.sorting()[sortBy] : undefined,
                        params.filter().closed,
                        params.filter().project
                    ).then(function (data) {
                        params.total(data.pagination.total);
                        return data.invalidatedTasks;
                    }, function(e) {
                        // an error occurred
                        return [];
                    });
                }
            });
        };

        /**
         * Set user details by calling the APIs
         */
        function setUserDetails() {
            // Get account details from account service
            getUser();

            // Get OSM account details from account service
            var osmDetailsPromise = userService.getOSMUserDetails(vm.username);
            osmDetailsPromise.then(function (data) {
                // On success, set the OSM account details for this user
                vm.osmUserDetails = data;
            })
        }

        /**
         * Returns true if the user is logged in and viewing their own profile,
         * false if not
         */
        vm.isOwnProfile = function() {
          return authService.getSession() ?
                 vm.username === authService.getSession().username :
                 false;
        }

        /**
         * Gets the user's project
         */
        function getUserProjects() {
            var resultsPromise = userService.getUserProjects(vm.username);
            resultsPromise.then(function (data) {
                vm.projects = data.mappedProjects;
                // iterate over the projects and add the center of the project as a point on the map
                for (var i = 0; i < vm.projects.length; i++) {
                    projectMapService.showProjectOnMap(vm.projects[i], vm.projects[i].centroid);
                }
            }, function () {
                vm.projects = [];
            });
        }

        /**
         * Set the user's role
         * @param role
         */
        vm.setRole = function (role) {
            vm.errorSetRole = false;
            var resultsPromise = userService.setRole(vm.username, role);
            resultsPromise.then(function (data) {
                getUser();
            }, function (data) {
                vm.errorSetRole = true;
            });
        };

        /**
         * Set the user's level
         * @param level
         */
        vm.setLevel = function(level){
            vm.errorSetLevel = false;
            var resultsPromise = userService.setLevel(vm.username, level);
            resultsPromise.then(function(data) {
               getUser();
            }, function(){
                vm.errorSetLevel = true;
            });
        };

        /**
         * Set the user's expert mode
         * @param isExpert
         */
        vm.setExpertMode = function(isExpert){
            vm.errorSetExpertMode = false;
            vm.savingExpertMode = true;
            userService.setExpertMode(isExpert).then(function(data) {
                getUser();
                vm.savingExpertMode = false;
            }, function(){
                vm.errorSetExpertMode = true;
                vm.savingExpertMode = false;
            });
        };

        /**
         * Get the user's details from the account service
         */
        function getUser() {
            var resultsPromise = accountService.getUser(vm.username);
            resultsPromise.then(function (data) {
                // On success, set the account details for this user
                vm.userDetails = data;
                // Get the account for the currently logged in user
                var account = accountService.getAccount();
                if (account) {
                    vm.currentlyLoggedInUser = account;
                }
            }, function () {
                // User is not logged in. The httpInterceptor service will handle this
            });
        }

        /**
         * Set contact details
         */
        vm.setContactDetails = function(){
            if (vm.contactDetailsForm.$valid){
                vm.errorSetContactDetails = false;
                var contactDetails = {
                    emailAddress: vm.userDetails.emailAddress,
                    gender: vm.userDetails.gender,
                    facebookId: vm.userDetails.facebookId,
                    linkedinId: vm.userDetails.linkedinId,
                    twitterId: vm.userDetails.twitterId,
                    validation_message : vm.userDetails.validation_message
                };
                var resultsPromise = userService.setContactDetails(contactDetails);
                resultsPromise.then(function (data) {
                    // Successfully saved
                    vm.editDetails = false;
                    vm.verificationEmailSent = data.verificationEmailSent;
                    getUser();
                }, function () {
                    vm.editDetails = false;
                    vm.errorSetContactDetails = true;
                    getUser();
                });
                vm.editDetails = false;
            }
        };

        /**
         * Resend the email verification email
         */
        vm.resendVerificationEmail = function(){
            vm.errorVerificationEmailSent = false;
            var resultsPromise = messageService.resendEmailVerification();
            resultsPromise.then(function (data) {
                // Successfully saved
                vm.verificationEmailSent = true;
                getUser();
            }, function () {
                vm.verificationEmailSent = false;
                vm.errorVerificationEmailSent = true;
                getUser();
            });
        };

        /**
         * View project for user and bounding box in Overpass Turbo
         * @param aoi
         */
        vm.viewOverpassTurbo = function (project_id) {
            var promise = projectService.getAOIServer(project_id);
            var tabWindow = $window.open('', '_blank');
            promise.then(function(aoi) {

                var feature = geospatialService.getFeatureFromGeoJSON(aoi);
                var olExtent = feature.getGeometry().getExtent();
                var bboxArray = geospatialService.transformExtentToLatLonArray(olExtent);
                var bbox = 'w="' + bboxArray[0] + '" s="' + bboxArray[1] + '" e="' + bboxArray[2] + '" n="' + bboxArray[3] + '"';
                var queryPrefix = '<osm-script output="json" timeout="25"><union>';
                var querySuffix = '</union><print mode="body"/><recurse type="down"/><print mode="skeleton" order="quadtile"/></osm-script>';
                var queryMiddle = '<query type="node"><user name="' + vm.username + '"/><bbox-query ' + bbox + '/></query>' +
                    '<query type="way"><user name="' + vm.username + '"/><bbox-query ' + bbox + '/></query>' +
                    '<query type="relation"><user name="' + vm.username + '"/><bbox-query ' + bbox + '/></query>';

                var query = queryPrefix + queryMiddle + querySuffix;
                tabWindow.location.href = 'http://overpass-turbo.eu/map.html?Q=' + encodeURIComponent(query);
            });
        };


        /**
         * Get the settings for the levels
         */
        function getLevelSettings(){
            var resultsPromise = settingsService.getSettings();
            resultsPromise.then(function (data) {
                vm.mapperLevelIntermediate = data.mapperLevelIntermediate;
                vm.mapperLevelAdvanced = data.mapperLevelAdvanced;
            });
        }

        /**
         * Get stats about the user
         */
        function getUserStats() {
            var resultsPromise = userService.getUserStats(vm.username);
            resultsPromise.then(function (data) {
                // On success, set the detailed stats for this user
                vm.userStats = data;
            });
        }

    }
})();
