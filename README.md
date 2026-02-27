# BatchBytes

Compact JavaScript application for sending bulk communication such as emails, SMS and WhatsApp messages.

## Features

- Send bulk emails, SMS and WhatsApp messages
- Create new users
- Delete users
- Update user details, such as token amount and status
- Send monthly usage report to active clients

## Run Locally

Clone the project

```bash
  git clone https://github.com/codecventer/batch-bytes
```

Go to the project directory

```bash
  cd batch-bytes
```

Install dependencies

```bash
  npm install
```

Start the application

```bash
  npm run index
```

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`AWS_REGION`

`AWS_ACCESS_KEY`

`AWS_SECRET_KEY`

`AWS_EMAIL_LOG_GROUP_NAME`

`AWS_SMS_LOG_STREAM_NAME`

`AWS_SMS_LOG_GROUP_NAME`

`AWS_BUCKET_NAME`

``

`WA_PHONE_NUMBER_ID`

`WA_BUSINESS_ACCOUNT_ID`

`WA_API_URL`

`WA_ACCESS_TOKEN`

``

`AUTH0_CLIENT_ID`

`AUTH0_DOMAIN`

`AUTH0_CONNECTION_NAME`

`AUTH0_CLIENT_SECRET`

`AUTH0_ACCESS_TOKEN`

``

`SMS_SHEET_LOCATION`

`EMAIL_SHEET_LOCATION`

`WHATSAPP_SHEET_LOCATION`

``

`APP_NAME`

`EMAIL_BATCH_SIZE`

`ADMIN_EMAIL_ADDRESS`

``

`TOKENS_PER_EMAIL`

`TOKENS_PER_SMS`

`TOKENS_PER_WHATSAPP`

``

`ACCOUNT_HOLDER`

`ACCOUNT_TYPE`

`BANK_NAME`

`BRANCH_CODE`

`BIC_SWIFT`

`ACCOUNT_NUMBER`

``

`ENABLE_SEND_SMS`

`ENABLE_SEND_EMAIL`

`ENABLE_SEND_WHATSAPP`

`ENABLE_SEND_LOG_FILE_TO_CLIENT`

`ENABLE_SEND_VERIFICATION_EMAIL`

`ENABLE_SEND_AUTH0_EMAIL`

`ENABLE_UPLOAD_LOG_FILE_TO_S3`

`ENABLE_SEND_MONTHLY_REPORT`

## Generate access token

curl --request POST --url https://dev-b6cvo0h3jdtwgpe8.us.auth0.com/oauth/token --header 'content-type: application/json' --data '{"client_id":"Ngwh0taAJWvinEGnGmI3aIJnNybUdzRY","client_secret":"d0jFQS6jUZxSByLh1fVVoSotFLrcaWenZJ5SIbYNtrJtSjZoRivWKqbD0EuDSLB0","audience":"https://dev-b6cvo0h3jdtwgpe8.us.auth0.com/api/v2/","grant_type":"client_credentials"}'

## Documentation

[AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

[html-format](https://www.npmjs.com/package/html-format)

[obscenity](https://www.npmjs.com/package/obscenity)

[prompts](https://www.npmjs.com/package/prompts)

[Auth0](https://auth0.com/docs/api/management/v2)

[Axios](https://axios-http.com/)

[xlsx](https://www.npmjs.com/package/xlsx)

[ESLint](https://www.npmjs.com/package/eslint)

[prettier](https://www.npmjs.com/package/prettier)

## Authors

- [@codecventer](https://www.github.com/codecventer)
