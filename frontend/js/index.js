'use strict';

/* global Vue */
/* global superagent */

var app = new Vue({
    el: '#app',
    data: {
        activeView: '',
        login: {
            username: '',
            password: ''
        },
        projects: [{
            published: '2016-05-03',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-02',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-04',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-01',
            name: 'Tom',
            release: 'v1.33.7'
        }],
        releases: [{
            published: '2016-05-03',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-02',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-04',
            name: 'Tom',
            release: 'v1.33.7'
        }, {
            published: '2016-05-01',
            name: 'Tom',
            release: 'v1.33.7'
        }],
        profile: {}
    },
    methods: {
        onLogin: function () {
            var that = this;

            superagent.get('/api/v1/profile').auth(this.login.username, this.login.password).end(function (error, result) {
                if (error) return console.error(error);
                if (result.statusCode !== 200) return console.error(result.statusCode, result.text);

                that.profile = result.body.user;
                that.activeView = 'releases';

                // stash the credentials in the local storage
                window.localStorage.username = that.login.username;
                window.localStorage.password = that.login.password;
            });
        },
        onLogout: function () {
            this.profile = null;

            // delete the credentials from the local storage
            delete window.localStorage.username;
            delete window.localStorage.password;

            this.activeView = 'login';
        },
        onProfileSubmit: function () {
            console.log(this.profile)
        },
        handleViewSelect: function (key) {
            if (!this.profile) this.activeView = 'login';
            else this.activeView = key;
        }
    },
    mounted: function () {
        var that = this;

        var username = window.localStorage.username || '';
        var password = window.localStorage.password || '';

        if (!username || !password) {
            this.profile = null;
            this.activeView = 'login';
            return;
        }

        superagent.get('/api/v1/profile').auth(username, password).end(function (error, result) {
            if (error) return console.error(error);
            if (result.statusCode !== 200) {
                // clear the local storage on wrong credentials
                delete window.localStorage.username;
                delete window.localStorage.password;

                return console.error(result.statusCode, result.text);
            }

            that.profile = result.body.user;
            that.activeView = 'releases';
        });
    }
});
