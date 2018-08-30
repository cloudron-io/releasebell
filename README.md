# Release Bell

A Self-Hosted Release Notification Service. Stay on top of releases for repos you star on GitHub.

## Installation

### Cloudron

Release Bell is packaged already as a Cloudron app and is installable directly from the Cloudron App Store.
It is fully integrated with the Cloudron usermanagement. The email sending is also preconfigured and needs not further configuration to work.

[![Install](https://cloudron.io/img/button.svg)](https://cloudron.io/button.html?app=io.cloudron.releasebell)

### Manual

Release Bell is a Nodejs app and thus requires Nodejs at least version 6.

```
mkdir releasebell
curl -L https://git.cloudron.io/cloudron/releasebell/-/archive/v1.0.1/releasebell-v1.0.1.tar.gz  | tar zxf - --strip-components 1 -C ./releasebell
cd releasebell
npm install
./index.js
```

#### User Management

While the app is multiuser aware, it does not come with a full blown usermanagement, but leaves this up to external services.
Currently only two are available:
  * local JSON file (for development only)
  * LDAP

Unless LDAP is configured, Release Bell will use a JSON file located at `./users.json` to contain the available users.
The file consists of a toplevel array with objects for each individual user:
```
[
    {
        "username": "test",
        "password": "plaintextpassword",
        "email": "test@example.com"
    }
]
```
Since the password is currently stored in plain text, this option is not recommended for production deployments.

To enable the LDAP backend, simply export the following env variables and adjust to your setup:
```
export LDAP_URL=ldaps://127.0.0.1:3002
export LDAP_USERS_BASE_DN=ou=users,dc=example
export LDAP_BIND_DN=CN=admin,ou=users,dc=example
export LDAP_BIND_PASSWORD=adminpassword
```

#### Sending Notifications via Email

Release Bell currently only supports sending out release notifications via email, so for a production deployment, export the following env variables and adjust to your setup:
```
export MAIL_SMTP_SERVER=smtp.example.com
export MAIL_SMTP_PORT=25
export MAIL_SMTP_USERNAME=
export MAIL_SMTP_PASSWORD=
export MAIL_FROM=releasebell@example.com
export MAIL_DOMAIN=example.com
export APP_ORIGIN=example.com
```
