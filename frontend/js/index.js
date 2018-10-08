'use strict';

/* global Vue */
/* global superagent */

var DEFAULT_VIEW = 'welcome';

new Vue({
    el: '#app',
    data: {
        activeView: '',
        login: {
            username: '',
            password: ''
        },
        loginSubmitBusy: false,
        projects: null,
        profile: {},
        profileSubmitBusy: false
    },
    methods: {
        onError: function (error) {
            var message;
            if (typeof error === 'string') message = error;
            else if (error.message) message = error.message;
            this.$message.error(message);
        },
        onLogin: function () {
            var that = this;

            that.loginSubmitBusy = true;
            superagent.get('/api/v1/profile').auth(this.login.username, this.login.password).end(function (error, result) {
                that.loginSubmitBusy = false;

                if (error && error.status === 401) {
                    that.$refs.loginInput.focus();
                    that.login.username = '';
                    that.login.password = '';
                    return that.onError('Invalid username or password');
                }
                if (error) return that.onError(error);
                if (result.statusCode !== 200) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

                // stash the credentials in the local storage
                window.localStorage.username = that.login.username;
                window.localStorage.password = that.login.password;

                that.profile = result.body.user;
                that.handleViewSelect(DEFAULT_VIEW);
            });
        },
        onLogout: function () {
            this.profile = null;

            // delete the credentials from the local storage
            delete window.localStorage.username;
            delete window.localStorage.password;

            this.handleViewSelect('login');
        },
        onProfileSubmit: function () {
            var that = this;

            that.profileSubmitBusy = true;
            superagent.post('/api/v1/profile').auth(this.login.username, this.login.password).send({ email: this.profile.email, githubToken: this.profile.githubToken }).end(function (error, result) {
                that.profileSubmitBusy = false;

                if (error && error.status === 402) {
                    that.$refs.githubTokenInput.focus();

                    if (error.response.body) that.onError(error.response.body);
                    else that.onError('Invalid GitHub token provided');

                    return;
                }
                if (error) return that.onError(error);
                if (result.statusCode !== 202) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

                if (that.profile.githubToken) that.$message.success('Done. Your tracked project list will be updated shortly.');
                else that.$message.success('Saved');
            });
        },
        handleViewSelect: function (key) {
            var that = this;

            if (!this.profile) this.activeView = 'login';
            else this.activeView = key;

            if (this.activeView === 'projects' || this.activeView === 'welcome') {
                this.projects = null;

                superagent.get('/api/v1/projects').auth(this.login.username, this.login.password).end(function (error, result) {
                    if (error) return that.onError(error);
                    if (result.statusCode !== 200) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

                    that.projects = result.body.projects;
                });
            } else if (this.activeView === 'login') {
                this.login.username = '';
                this.login.password = '';
            }
        },
        prettyDate: function (row, column, cellValue, index) {
            if (!cellValue) return '';

            var date = new Date(cellValue),
            diff = (((new Date()).getTime() - date.getTime()) / 1000),
            day_diff = Math.floor(diff / 86400);

            if (isNaN(day_diff) || day_diff < 0)
                return;

            return day_diff === 0 && (
                diff < 60 && 'just now' ||
                diff < 120 && '1 minute ago' ||
                diff < 3600 && Math.floor( diff / 60 ) + ' minutes ago' ||
                diff < 7200 && '1 hour ago' ||
                diff < 86400 && Math.floor( diff / 3600 ) + ' hours ago') ||
                day_diff === 1 && 'Yesterday' ||
                day_diff < 7 && day_diff + ' days ago' ||
                day_diff < 31 && Math.ceil( day_diff / 7 ) + ' weeks ago' ||
                day_diff < 365 && Math.round( day_diff / 30 ) +  ' months ago' ||
                Math.round( day_diff / 365 ) + ' years ago';
        },
        setProjectState: function (projectId, state, scope) {
            var that = this;

            scope.row.busy = true;

            superagent.post('/api/v1/projects/' + projectId).auth(this.login.username, this.login.password).send({ enabled: state }).end(function (error, result) {
                scope.row.busy = false;

                if (error) return that.onError(error);
                if (result.statusCode !== 202) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

                // update the ui now
                that.projects.find(function (p) { return p.id === projectId; }).enabled = state;
            });
        },
        sort: function (a, b) {
            // default sorting uses case-sensitive sorting
            return a.name.toUpperCase() < b.name.toUpperCase();
        }
    },
    mounted: function () {
        var that = this;

        that.login.username = window.localStorage.username || '';
        that.login.password = window.localStorage.password || '';

        if (!that.login.username || !that.login.password) {
            that.profile = null;
            that.handleViewSelect('login');
            return;
        }

        superagent.get('/api/v1/profile').auth(that.login.username, that.login.password).end(function (error, result) {
            if (error && error.status === 401) {
                // clear the local storage on wrong credentials
                delete window.localStorage.username;
                delete window.localStorage.password;

                that.profile = null;
                that.handleViewSelect('login');

                return;
            }
            if (error) return that.onError(error);
            if (result.statusCode !== 200) that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

            that.profile = result.body.user;
            that.handleViewSelect(DEFAULT_VIEW);
        });
    }
});
