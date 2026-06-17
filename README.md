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
    permissionGroup: owners # Permission group that is allowed access to this product (optional)
categories: # You can also bundle multiple products in a category
  - name: category1 # Choose a unique name for the category
    openapi: swagger.json # link to an openapi spec in yaml or json format
    products:
      - name: ID-of-the-API
        inheritSpec: true # You can choose to let the product inherit the spec from the category
        permissionGroup: owners # Permission group that is allowed access to this product (optional)
      - name: ID-of-the-API
        inheritSpec: false
        openapi: swagger.json # Or the product will have it's own spec
        permissionGroup: owners # Permission group that is allowed access to this product (optional)
        backendTeam: backend-squad # optional: assign this API product to a backend team (by team name)
teams: # optional: producer teams (teamType normal)
  - name: team-name
    owner: owner@test.com
    permissionGroups:
      - owners
backendTeams: # optional: backend teams (teamType backend)
  - name: backend-squad
    owner: owner@test.com # query param developerId when creating the team (required by the API for membership)
    permissionGroups:
      - owners
```
Run:
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

### Backend teams

- **`backendTeams`**: same shape as `teams`, but each entry is created with `teamType: backend`. If a team with the same name already exists, it must already be a backend team or the CLI fails with a clear error.
- **`backendTeam` on a product** (top-level `products` or under `categories[].products`): optional. When set to a string, the CLI resolves the backend team by name and calls `POST /api/environments/{environment}/apiproducts/{productId}/assign-backend-team`. When set to `null` or YAML `~`, the CLI **unassigns** any backend team for that product. **Omit the key** entirely if you do not want the CLI to change existing assignments for that product.
- **Authorization**: the Apidex API currently allows **admin** callers (not plain `cicd` service accounts without admin) on the assign-backend-team endpoint. Ensure your `--token` or client-credentials user has admin rights before relying on assignments in CI.

### Automated tests

```bash
npm test
```

Coverage thresholds are enforced in `jest.config.js`: 90% global minimum, with higher bars for `formatAxiosError.js` and `portal.js`.

### Manual integration verification

1. Use a throwaway manifest with `backendTeams` and a `backendTeam` on one product; run `apidex-cli upload-spec …`.
2. Confirm with the Apidex API (`GET /api/teams`, or your tenant’s admin tools) that the team exists as `teamType: backend` and the product assignment matches.
3. **Cleanup**: call assign with `{ "backendTeamId": null }` (or manifest `backendTeam: ~`), then `DELETE /api/teams/{id}` for the scratch team.
