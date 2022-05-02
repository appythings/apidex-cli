# apidex-cli
Commandline tool to use the management APIs of Apidex

## Installation
```npm i -g @appythings/apidex-cli```

## Usage
To upload your API's to apidex, create a yaml file with the following content:
```
products:
  - name: ID-of-the-API # For SAP and Apigee this is the name of the product, not the displayName
    openapi: swagger.json # link to an openapi spec in yaml or json format
categories: # You can also bundle multiple products in a category
  - name: category1 # Choose a unique name for the category
    openapi: swagger.json # link to an openapi spec in yaml or json format
    products:
      - name: ID-of-the-API
        inheritSpec: true # You can choose to let the product inherit the spec from the category
      - name: ID-of-the-API
        inheritSpec: false
        openapi: swagger.json # Or the product will have it's own spec
```
```
apidex-cli upload-spec [options] <manifest>

uploads an openapi spec to apidex

Options:
  --environment <environment>    add the environment to deploy this to
  --host <host>                  add the hostname for the developer portal
  --clientId <clientId>          add the clientId from your OpenID Connect provider linked to the developer portal
  --clientSecret <clientSecret>  add the clientSecret from your OpenID Connect provider linked to the developer portal
  --aud <aud>                    Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token. (default: null)
  --scope <scope>                add the scope for the developer portal app registration
  --tokenUrl <tokenUrl>          add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)
  --force                        Force the database to overwrite spec regardless of version number (default: false)
  --token <token>                provide a token instead
  -h, --help                     display help for command
```
```
apidex-cli upload-markdown [options] <directory>

uploads a directory of markdown files to apidex

Options:
  --host <host>                  add the hostname for the developer portal
  --clientId <clientId>          add the clientId from your OpenID Connect provider linked to the developer portal
  --clientSecret <clientSecret>  add the clientSecret from your OpenID Connect provider linked to the developer portal
  --aud <aud>                    Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token. (default: null)
  --scope <scope>                add the scope for the developer portal app registration
  --tokenUrl <tokenUrl>          add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)
  -h, --help                     display help for command

```
