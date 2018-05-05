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
        projects: null,
        profile: {}
    },
    methods: {
        onLogin: function () {
            var that = this;

            superagent.get('/api/v1/profile').auth(this.login.username, this.login.password).end(function (error, result) {
                if (error && error.status === 401) {
                    that.login.username = '';
                    that.login.password = '';
                    return;
                }
                if (error) return console.error(error);
                if (result.statusCode !== 200) return console.error(result.statusCode, result.text);

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
            superagent.post('/api/v1/profile').auth(this.login.username, this.login.password).send({ email: this.profile.email, githubToken: this.profile.githubToken }).end(function (error, result) {
                if (error && error.status === 402) return console.error('github token invalid');
                if (error) return console.error(error);
                if (result.statusCode !== 202) return console.error(result.statusCode, result.text);

                console.log('Success');
            });
        },
        handleViewSelect: function (key) {
            var that = this;

            if (!this.profile) this.activeView = 'login';
            else this.activeView = key;

            if (key === 'projects') {
                this.projects = null;

                superagent.get('/api/v1/projects').auth(this.login.username, this.login.password).end(function (error, result) {
                    if (error) return console.error(error);
                    if (result.statusCode !== 200) return console.error(result.statusCode, result.text);

                    that.projects = result.body.projects;
                });
            }
        },
        setProjectState: function (projectId, state) {
            console.log(projectId, state);
        }
    },
    mounted: function () {
        var that = this;

        this.login.username = window.localStorage.username || '';
        this.login.password = window.localStorage.password || '';

        if (!this.login.username || !this.login.password) {
            this.login.username = '';
            this.login.password = '';
            this.profile = null;
            this.handleViewSelect('login');
            return;
        }

        superagent.get('/api/v1/profile').auth(this.login.username, this.login.password).end(function (error, result) {
            if (error && error.status === 401) {
                // clear the local storage on wrong credentials
                delete window.localStorage.username;
                delete window.localStorage.password;

                that.profile = null;
                that.handleViewSelect('login');

                return;
            }
            if (error || result.statusCode !== 200) return console.error(error);

            that.profile = result.body.user;
            that.handleViewSelect(DEFAULT_VIEW);
        });
    }
});
