
<template>
  <div class="login-container" v-show="!busy && !user">
    <div class="login-logo"><img src="/favicon.png"/></div>
    <h1>Release Bell</h1>
    <a :href="loginUrl"><Button id="loginButton" label="Login with Cloudron"/></a>
  </div>
  <MainLayout v-show="!busy && user">
    <template #dialogs>
      <!-- Add Project Dialog -->
      <Dialog header="Add Project" v-model:visible="addProjectDialog.visible" :dismissableMask="true" :closable="true" :style="{ maxWidth: '100%', width: '1028px'}" :modal="true">
        <form @submit="onAddProjectSubmit()" @submit.prevent>
          <div>
            <div class="form-field">
              <label for="addProjectTypeInput">Type</label>
              <Dropdown v-model="addProjectDialog.type" :options="projectTypes" optionLabel="name" inputId="addProjectTypeInput"/>
            </div>
            <div class="form-field">
              <label for="addProjectUrlInput">URL</label>
              <InputText id="addProjectUrlInput" type="text" v-model="addProjectDialog.url" autofocus required :class="{ 'p-invalid': addProjectDialog.error }"/>
              <small class="p-invalid" v-show="addProjectDialog.error">{{ addProjectDialog.error }}</small>
            </div>
          </div>
        </form>
        <template #footer>
          <Button label="Cancel" icon="pi pi-times" class="p-button-text" @click="addProjectDialog.visible = false"/>
          <Button label="Add" id="addProjectSubmitButton" :icon="addProjectDialog.busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'" :disabled="!addProjectDialog.url || addProjectDialog.busy" class="p-button-text p-button-success" @click="onAddProjectSubmit()"/>
        </template>
      </Dialog>

      <!-- Settings Dialog -->
      <Dialog header="Settings" v-model:visible="settingsDialog.visible" :dismissableMask="true" :closable="true" :style="{ maxWidth: '100%', width: '728px'}" :modal="true">
        <form @submit="onSettingsSubmit()" @submit.prevent>
          <div>
            <div class="form-field">
              <label for="githubTokenInput">Github Token</label>
              <InputText id="githubTokenInput" type="text" v-model="settingsDialog.githubToken" autofocus required :class="{ 'p-invalid': settingsDialog.error }"/>
              <small class="text-error" v-show="settingsDialog.error">{{ settingsDialog.error }}</small>
              <br/>
              <br/>
              <a href="https://github.com/settings/tokens/new?description=ReleaseBell" target="_blank" style="margin-top: 10px;">Generate a GitHub API token</a>
            </div>
          </div>
        </form>
        <template #footer>
          <Button label="Cancel" icon="pi pi-times" class="p-button-text" @click="settingsDialog.visible = false"/>
          <Button label="Save" :icon="settingsDialog.busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'" :disabled="!settingsDialog.githubToken || settingsDialog.busy" class="p-button-text p-button-success" @click="onSettingsSubmit()"/>
        </template>
      </Dialog>
    </template>
    <template #header>
      <TopBar class="navbar">
        <template #left>
          <img src="/favicon.png" style="height: 24px; margin-right: 10px"/> Release Bell
        </template>
        <template #right>
          <Button class="p-button-sm" style="margin-right: 10px" severity="primary" icon="pi pi-plus" label="Add Project" @click="onShowAddProjectDialog()"/>
          <Button class="p-button-sm" style="margin-right: 10px" severity="primary" icon="pi pi-cog" label="Settings" @click="onShowSettingsDialog()"/>
          <Button class="p-button-sm" severity="secondary" icon="pi pi-sign-out" label="Logout" @click="onLogout()"/>
        </template>
      </TopBar>
    </template>
    <template #body>
      <div class="main-view">
        <div style="text-align: center;" v-show="projects.length === 0">
          <img src="/favicon.png" style="width: 64px;"/>
          <h1>Welcome to Release Bell</h1>
          <p>Set a GitHub token in your <a href="" @click.prevent="onShowSettingsDialog()">profile</a> to start receiving new release notifcations for your starred repos or add <a href="" @click.prevent="onShowAddProjectDialog()">GitLab project URLs</a> for release notifications for those projects.</p>
        </div>
        <DataTable :value="projects" stripedRows style="max-width: 1280px; margin: auto" tableStyle="min-width: 50rem" v-show="projects.length !== 0" class="p-datatable-sm">
          <Column field="name" header="Name" sortable>
            <template #body="slotProps">
              <a :href="'https://github.com/' + slotProps.data.name" target="_blank" v-show="slotProps.data.type === 'github' || slotProps.data.type === 'github_manual'">{{ slotProps.data.name }}</a>
              <a :href="slotProps.data.origin + '/' + slotProps.data.name" target="_blank" v-show="slotProps.data.type === 'gitlab'">{{ slotProps.data.name }}</a>
            </template>
          </Column>
          <Column field="type" header="Type" sortable>
            <template #body="slotProps">
              <img :src="'/' + slotProps.data.type + '.svg'" class="type-icon"/> {{ slotProps.data.type }}
            </template>
          </Column>
          <Column field="version" header="Last Version" sortable>
            <template #body="slotProps">
              <a :href="'https://github.com/' + slotProps.data.name + '/releases/tag/' + slotProps.data.version" target="_blank" v-show="slotProps.data.type === 'github' || slotProps.data.type === 'github_manual'">{{ slotProps.data.version }}</a>
              <a :href="slotProps.data.origin + '/' + slotProps.data.name + '/-/tags/' + slotProps.data.version" target="_blank" v-show="slotProps.data.type === 'gitlab'">{{ slotProps.data.version }}</a>
            </template>
          </Column>
          <Column field="createdAt" header="Released At" sortable>
            <template #body="slotProps">
              {{ prettyDate(slotProps.data.createdAt) }}
            </template>
          </Column>
          <Column>
            <template #body="slotProps">

            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </MainLayout>
</template>

<script>

import superagent from 'superagent';

import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

import { BottomBar, MainLayout, TopBar } from 'pankow';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || '';

export default {
  name: 'App',
  components: {
    BottomBar,
    Button,
    Column,
    DataTable,
    Dropdown,
    MainLayout,
    TopBar
  },
  data() {
    return {
      busy: true,
      user: null,
      projects: [],
      loginUrl: `${API_ORIGIN}/api/v1/login?returnTo=${location.origin}`,
      projectTypes: [{
        type: 'github_manual',
        name: 'Github'
      }, {
        type: 'gitlab',
        name: 'GitLab'
      }],
      addProjectDialog: {
        visible: false,
        busy: false,
        url: '',
      },
      settingsDialog: {
        visible: false,
        busy: false,
        error: '',
        data: {}
      },
    };
  },
  methods: {
    prettyDate: function (value) {
      if (!value) return '';

      var date = new Date(value),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);

      if (isNaN(day_diff) || day_diff < 0) return;

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
    async onLogout() {
      await superagent.get(`${API_ORIGIN}/api/v1/logout?return_to=${location.origin}`);
      this.user = null;
    },
    async refresh() {
      const result = await superagent.get(`${API_ORIGIN}/api/v1/projects`);
      // if (error) return that.onError(error);
      // if (result.statusCode !== 200) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);

      this.projects = result.body.projects;
    },
    onShowAddProjectDialog() {
      this.addProjectDialog.url = '';
      this.addProjectDialog.type = this.projectTypes[0];
      this.addProjectDialog.visible = true;
    },
    onShowSettingsDialog() {
      this.settingsDialog.githubToken = this.user.githubToken;
      this.settingsDialog.error = '';
      this.settingsDialog.visible = true;
    },
    async onAddProjectSubmit() {
      // https://codeberg.org/teddit/teddit
      const url = new URL(this.addProjectDialog.url);

      const components = url.pathname.split('/');
      if (components.length < 3) return console.error('Invalid gitlab/github url');

      const data = {
        type: this.addProjectDialog.type.type,
        name: components[1] + '/' + components[2],
        origin: url.origin
      };

      this.addProjectDialog.busy = true;
      await superagent.post(`${API_ORIGIN}/api/v1/projects/`).send(data);
      this.addProjectDialog.visible = false;
      this.addProjectDialog.busy = false;

      // if (error) return that.onError(error);
      // if (result.statusCode !== 201) return that.onError('Unexpected response: ' + result.statusCode + ' ' + result.text);
      await this.refresh();
    },
    async onSettingsSubmit() {
      this.settingsDialog.busy = true;
      this.settingsDialog.error = '';

      try {
        await superagent.post(`${API_ORIGIN}/api/v1/profile`).send({ githubToken: this.settingsDialog.githubToken });
      } catch (error) {
        if (error.status === 402) {
          document.getElementById('githubTokenInput').focus();
          this.settingsDialog.error = 'Invalid GitHub token provided';
        } else {
          console.error('Unexpected error saving profile', error);
        }

        this.settingsDialog.busy = false;
        return;
      }

      this.settingsDialog.busy = false;
      this.settingsDialog.visible = false;
    }
  },
  async mounted() {
    this.busy = true;

    try {
      const result = await superagent.get(`${API_ORIGIN}/api/v1/profile`);
      this.user = result.body.user;

      await this.refresh();
    } catch (e) {
      if (e.status !== 401) console.error(e);
    }

    this.busy = false;
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

.form-field {
  margin-top: 10px;
  margin-bottom: 10px;
}

.form-field > label {
  display: block;
  margin-bottom: 10px;
}

.form-field > * {
  width: 100%;
}

.type-icon {
  height: 24px;
  vertical-align: middle;
  padding-right: 10px;
  filter: grayscale(0.5);
}

</style>
