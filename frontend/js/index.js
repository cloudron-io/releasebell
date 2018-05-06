'use strict';

/* global Vue */
/* global superagent */

var DEFAULT_VIEW = 'welcome';

var app = new Vue({
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
                    return that.onError('Invalid GitHub token provided');
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

            if (this.activeView === 'projects') {
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
        setProjectState: function (projectId, state) {
            console.log(projectId, state);
        }
    },
    mounted: function () {
        var that = this;

        this.$nextTick(function () {
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
        });
    }
});
