const axios = require('axios');
const qs = require('qs');
const SwaggerParser = require('@apidevtools/swagger-parser');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const FormData = require('form-data');
const jwt = require('../lib/jwt');

class Portal {
  constructor(config, manifest) {
    if (manifest) {
      let yml = yaml.load(fs.readFileSync(manifest, 'utf8'));
      this.teamConfig = yml.teams;
      const productConfig = yml.products;
      this.categories = yml.categories;
      if (
        (!productConfig || !productConfig.find(product => product.openapi)) &&
        !this.categories
      ) {
        throw new Error('no product found to upload');
      }
      if (productConfig) {
        this.swaggerFiles = productConfig.filter(product => product.openapi);
      }
    }
    this.config = config;
    this.request = axios.create({
      baseURL: this.config.hostname,
      timeout: 60000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (config.token) {
      this.request.defaults.headers.common['Authorization'] =
        'Bearer ' + config.token;
    }
  }

  async login() {
    if (this.request.defaults.headers.common['Authorization']) {
      return;
    }
    const data = {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: this.config.grantType,
      scope: this.config.scope,
    };
    if (process.env.PRIVATE_KEY_BASE64 && process.env.PUBLIC_KEY_BASE64) {
      const privateKey = Buffer.from(
        process.env.PRIVATE_KEY_BASE64,
        'base64',
      ).toString('utf8');
      const publicKey = Buffer.from(
        process.env.PUBLIC_KEY_BASE64,
        'base64',
      ).toString('utf8');
      data.client_assertion = jwt.create(
        this.config.clientId,
        privateKey,
        publicKey,
        this.config.aud,
      );
      data.client_assertion_type =
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
    }
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: qs.stringify(data),
      url: this.config.tokenUrl,
    };
    const response = await axios(options);
    this.request.defaults.headers.common['Authorization'] =
      'Bearer ' + response.data.access_token;
  }

  readSwaggerFile(spec) {
    const swagger = fs.readFileSync(spec, 'utf8');

    if (spec.endsWith('.yml') || spec.endsWith('.yaml')) {
      return yaml.load(swagger);
    }
    if (spec.endsWith('.json')) {
      return JSON.parse(swagger);
    }
    throw new Error('Openapi spec must be either yaml/yml or json');
  }

  async pushSwagger() {
    if (!this.swaggerFiles) {
      return;
    }
    return Promise.all(
      this.swaggerFiles.map(async product => {
        console.log(
          `Uploading ${product.openapi} for product: ${product.name}`,
        );
        const parsedSwagger = await this.readSwaggerFile(product.openapi);
        await SwaggerParser.validate(product.openapi);
        if (!this.config.token) {
          await this.login();
        }
        return this.request
          .post(
            `api/environments/${this.config.environment}/apiproducts/${
              product.name
            }/specs${this.config.force ? '?force=true' : ''}`,
            {
              spec: parsedSwagger,
              inheritSpec: false,
              permissiongroup: product.permissionGroup,
              latest: true,
            },
          )
          .catch(e => {
            console.log(`Failed to upload ${product.name}`);
            throw e;
          });
      }),
    );
  }

  async pushCategories() {
    if (!this.categories) {
      return;
    }
    return Promise.all(
      this.categories.map(async category => {
        console.log(`Uploading ${category.name}`);
        const parsedSwagger = await this.readSwaggerFile(category.openapi);
        await SwaggerParser.validate(category.openapi);
        await this.login();
        await this.request.post(`api/specs`, {
          environmentId: this.config.environment,
          categoryId: category.name,
          spec: parsedSwagger,
          latest: true,
        });

        return Promise.all(
          category.products.map(async product => {
            console.log(`Uploading ${product.name}`);
            let parsedSwagger;
            if (product.inheritSpec === false) {
              if (!product.openapi) {
                console.log('You have to specify spec');
                return;
              }
              parsedSwagger = await this.readSwaggerFile(product.openapi);
              await SwaggerParser.validate(product.openapi);
            }
            return this.request
              .post(
                `api/environments/${this.config.environment}/apiproducts/${
                  product.name
                }/specs${this.config.force ? '?force=true' : ''}`,
                {
                  spec: parsedSwagger,
                  categoryId: category.name,
                  inheritSpec: product.inheritSpec,
                  permissiongroup: product.permissionGroup,
                  latest: true,
                },
              )
              .catch(e => {
                console.log(`Failed to upload ${product.name}`);
                throw e;
              });
          }),
        );
      }),
    );
  }

  async pushTeams() {
    if (!this.teamConfig) {
      return;
    }
    return Promise.all(
      this.teamConfig.map(async team => {
        if (!this.config.token) {
          await this.login();
        }
        console.log(team)

        let teamId;
        try {
          const teamsResponse = await this.request.get(`api/teams`);

          // Check if team already exists
          const existingTeam = teamsResponse.data.find(
            existingTeam => existingTeam.name === team.name,
          );

          let result;
          if (existingTeam) {
            console.log(
              `Team ${team.name} already exists, using existing team ID: ${existingTeam.id}`,
            );
            result = {status: 200, data: existingTeam};
          } else {
            // Team doesn't exist, create a new one
            console.log(`Team ${team.name} doesn't exist, creating new team`);
            result = await this.request.post(
              `api/teams?developerId=${team.owner}`,
              {
                name: team.name,
              },
            );
          }

          if (result?.status !== 200 && !result?.data.id) {
            console.log(`102 - Failed to upload ${team.name}`);
            return;
          }

          teamId = result.data.id;
          console.log(`Team ID: ${teamId}`);

          // Loop over permission groups and add them to the team
          if (team.permissionGroups) {
            console.log(
              `Adding permission groups ${team.permissionGroups.join(', ')}`,
            );

            try {
              const existingPermGroupsResponse = await this.request.get(
                `api/teams/${teamId}/permissiongroups`,
              );

              const existingPermGroups = existingPermGroupsResponse.data || [];

              await Promise.all(
                team.permissionGroups.map(async permissionGroup => {
                  const permGroupExists = existingPermGroups.some(
                    existingPerm => existingPerm.name === permissionGroup,
                  );

                  if (permGroupExists) {
                    console.log(
                      `Permission group ${permissionGroup} already exists for team ${team.name}, skipping`,
                    );
                    return;
                  }

                  console.log(`Adding permission group ${permissionGroup}`);
                  try {

                    const existingPermissionGroup = await this.request.get(
                        `api/permissiongroups?filter={"where": { "name":"${permissionGroup}" } }`,
                      );
                    if (existingPermissionGroup.data.length > 0) {
                      console.log(`Adding team to existing permission group ${existingPermissionGroup.data[0].id}`);
                      await this.request.put(
                        `api/teams/${teamId}/permissiongroups/rel/${existingPermissionGroup.data[0].id}`,
                      );
                      return;
                    }
                    console.log(`Adding team to new permission group ${permissionGroup}`);
                    await this.request.post(
                      `api/teams/${teamId}/permissiongroups`,
                      {
                        name: permissionGroup,
                      },
                    );
                  } catch (permError) {
                    console.log(
                      `Failed to add permission group ${permissionGroup}: ${permError.message}`,
                    ); // Continue with other permission groups instead of throwing
                  }
                }),
              );
            } catch (permGroupsError) {
              console.log(
                `Failed to retrieve permission groups for team ${team.name}: ${permGroupsError.message}`,
              ); // Continue with next team via early return
              return;
            }
          }
        } catch (teamError) {
          console.log(
            `Error processing team ${team.name}: ${teamError.message}`,
            teamError.response
              ? JSON.stringify(teamError.response.data)
              : '',
          ); // Continue with next team via early return
          return;
        }
      }),
    );
  }

  async getProducts() {
    const products = await this.request.get(
      `api/environments/${this.config.environment}/apiproducts`,
    );
    return products.data.filter(product =>
      this.swaggerFiles.find(
        swaggerFileProduct => swaggerFileProduct.name === product.name,
      ),
    );
  }

  async pushMarkdown(zipFile) {
    if (!this.config.token) {
      await this.login();
    }
    const form = new FormData();
    form.append('zip', zipFile, {
      filename: 'markdown.zip',
    });
    return axios.post(
      `https://${this.config.hostname}/markdown`,
      form.getBuffer(),
      {
        headers: {
          ...form.getHeaders(),
          Authorization: this.request.defaults.headers.common['Authorization'],
        },
      },
    );
  }
}

module.exports = Portal;
