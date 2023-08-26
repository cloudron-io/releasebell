<template>
  <div class="login-container" v-show="!busy && !user">
    <div class="login-logo"><img src="/favicon.png"/></div>
    <h1>Release Bell</h1>
    <a href="/api/v1/login"><Button id="loginButton" label="Login with Cloudron"/></a>
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
      window.location.href = '/api/v1/logout';
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

.login-container {
  max-width: 480px;
  margin: auto;
  padding: 20px;
  text-align: center;
  margin-top: 50px;
  background-color: white;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.login-container img {
  max-height: 128px;
}

.login-container h1 {
  font-size: 30px;
  font-weight: normal;
}

</style>
