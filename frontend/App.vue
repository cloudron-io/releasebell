<template>
  <div class="login-container" v-show="!busy && !user">
    <div class="login-logo"><img src="/favicon.png"/></div>
    <h1>Release Bell</h1>
    <a href="/api/oidc/login"><Button id="loginButton" label="Login with Cloudron"/></a>
  </div>
</template>

<script>

import superagent from 'superagent';

export default {
  name: 'App',
  data() {
    return {
      busy: true,
      user: null
    };
  },
  methods: {
    logout () {
      window.location.href = '/api/oidc/logout';
    }
  },
  mounted() {
    this.busy = true;

    superagent.get('/api/v1/profile').end((error, result) => {
      this.busy = false;

      if (result && result.statusCode === 401) return;
      if (error) return console.error(error);

      this.user = result.body.user;
    });
  }
};

</script>

<style scoped>
</style>
