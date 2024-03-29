import { createApp } from 'vue';

import PrimeVue from 'primevue/config';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Menu from 'primevue/menu';
import ProgressBar from 'primevue/progressbar';
import Message from 'primevue/message';
import Toolbar from 'primevue/toolbar';
import Checkbox from 'primevue/checkbox';
import Tooltip from 'primevue/tooltip';
import RadioButton from 'primevue/radiobutton';
import ConfirmationService from 'primevue/confirmationservice';
import ConfirmPopup from 'primevue/confirmpopup';
import ToastService from 'primevue/toastservice';
import Toast from 'primevue/toast';

import 'primevue/resources/themes/saga-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';

import './style.css';

import App from './App.vue';

const app = createApp(App);

app.use(PrimeVue);
app.use(ConfirmationService);
app.use(ToastService);

app.component('Dialog', Dialog);
app.component('RadioButton', RadioButton);
app.component('InputText', InputText);
app.component('Password', Password);
app.component('Menu', Menu);
app.component('ProgressBar', ProgressBar);
app.component('Message', Message);
app.component('Checkbox', Checkbox);
app.component('Toolbar', Toolbar);
app.component('ConfirmPopup', ConfirmPopup);
app.component('Toast', Toast);

app.directive('tooltip', Tooltip);

app.mount('#app');