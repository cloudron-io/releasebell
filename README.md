# Release Bell

A Self-Hosted Release Notification Service. Stay on top of releases for repos you star on GitHub.

## Installation

### Cloudron

Release Bell is packaged already as a Cloudron app and is installable directly from the Cloudron App Store.
It is fully integrated with the Cloudron usermanagement. The email sending is also preconfigured and needs not further configuration to work.

[![Install](https://cloudron.io/img/button.svg)](https://cloudron.io/button.html?app=io.cloudron.releasebell)

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
