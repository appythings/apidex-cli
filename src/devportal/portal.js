const axios = require('axios');
const qs = require('qs');
const SwaggerParser = require('@apidevtools/swagger-parser');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const FormData = require('form-data');
const jwt = require('../lib/jwt');
const {formatRequestError} = require('../lib/formatAxiosError');
const {canonicalizeLocale, loadOverlays} = require('../lib/overlays');

class Portal {
  /** @param {Record<string, unknown>} yml */
  static collectBackendTeamAssignments(yml) {
    const out = [];
    if (Array.isArray(yml.products)) {
      for (const p of yml.products) {
        if (Object.prototype.hasOwnProperty.call(p, 'backendTeam')) {
          out.push({productName: p.name, backendTeam: p.backendTeam});
        }
      }
    }
    if (Array.isArray(yml.categories)) {
      for (const cat of yml.categories) {
        if (!Array.isArray(cat.products)) {
          continue;
        }
        for (const p of cat.products) {
          if (Object.prototype.hasOwnProperty.call(p, 'backendTeam')) {
            out.push({productName: p.name, backendTeam: p.backendTeam});
          }
        }
      }
    }
    return out;
  }

  constructor(config, manifest) {
    this.backendTeamConfig = [];
    this.backendTeamAssignments = [];
    if (manifest) {
      let yml = yaml.load(fs.readFileSync(manifest, 'utf8'));
      this.teamConfig = yml.teams;
      this.backendTeamConfig = Array.isArray(yml.backendTeams)
        ? yml.backendTeams
        : [];
      const productConfig = yml.products;
      this.categories = yml.categories;
      this.backendTeamAssignments = Portal.collectBackendTeamAssignments(yml);
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

  overlayDropError(name, locales) {
    return new Error(
      `Refusing to upload ${name} without overlay files: the portal already has overlays for ${locales.join(', ')}. Declare overlays in the manifest or DELETE /api/specs/{id}/overlays.`,
    );
  }

  overlayPartialDropError(name, locales) {
    return new Error(
      `Refusing to upload ${name}: the new version would drop overlays for ${locales.join(', ')}. Declare overlays for those locales in the manifest or DELETE /api/specs/{id}/overlays.`,
    );
  }

  apiproductSpecsPath(productName) {
    return `api/environments/${encodeURIComponent(
      this.config.environment,
    )}/apiproducts/${encodeURIComponent(productName)}/specs`;
  }

  markdownUploadUrl() {
    const host = this.config.hostname || '';
    if (/^https?:\/\//i.test(host)) {
      return `${String(host).replace(/\/$/, '')}/markdown`;
    }
    return `https://${host}/markdown`;
  }

  async fetchOverlayLocalesForSpec(specId) {
    if (!specId) return [];
    try {
      const response = await this.request.get(`api/specs/${specId}/overlays`);
      const rows = Array.isArray(response.data) ? response.data : [];
      return rows.map(row => row.locale).filter(Boolean);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async fetchLatestProductSpecId(productName) {
    try {
      const response = await this.request.get(
        this.apiproductSpecsPath(productName),
      );
      const specs = Array.isArray(response.data) ? response.data : [];
      const latest = specs.find(spec => spec.latest) || specs[0];
      return latest && latest.id;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async fetchLatestCategorySpecId(categoryId) {
    try {
      const filter = JSON.stringify({
        where: {
          and: [
            {categoryId},
            {environmentId: this.config.environment},
          ],
        },
      });
      const response = await this.request.get(
        `api/specs?filter=${encodeURIComponent(filter)}`,
      );
      const specs = Array.isArray(response.data) ? response.data : [];
      const categorySpecs = specs.filter(spec => !spec.productId);
      const latest =
        categorySpecs.find(spec => spec.latest) || categorySpecs[0];
      return latest && latest.id;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * New spec versions do not copy overlays. Uploading without overlay files,
   * or with a subset of the locales already published, would drop translations
   * from the new version — fail instead.
   */
  async assertOverlaysNotDropped(name, overlays, options = {}) {
    let specId = options.specId;
    if (!specId && options.categoryId) {
      specId = await this.fetchLatestCategorySpecId(options.categoryId);
    } else if (!specId) {
      specId = await this.fetchLatestProductSpecId(name);
    }
    const existing = await this.fetchOverlayLocalesForSpec(specId);
    if (existing.length === 0) {
      return;
    }

    const incoming = new Set(
      (Array.isArray(overlays) ? overlays : [])
        .map(entry => canonicalizeLocale(entry && entry.locale))
        .filter(Boolean),
    );
    if (incoming.size === 0) {
      throw this.overlayDropError(name, existing);
    }

    const dropped = existing.filter(locale => {
      const canonical = canonicalizeLocale(locale) || locale;
      return !incoming.has(canonical);
    });
    if (dropped.length > 0) {
      throw this.overlayPartialDropError(name, dropped);
    }
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
        const overlays = loadOverlays(product);
        if (overlays.length > 0) {
          console.log(
            `Including ${overlays.length} overlay(s) for ${product.name}: ${overlays
              .map(entry => entry.locale)
              .join(', ')}`,
          );
        }
        if (!this.config.token) {
          await this.login();
        }
        await this.assertOverlaysNotDropped(product.name, overlays);
        return this.request
          .post(
            `${this.apiproductSpecsPath(product.name)}${
              this.config.force ? '?force=true' : ''
            }`,
            {
              spec: parsedSwagger,
              inheritSpec: false,
              permissiongroup: product.permissionGroup,
              latest: true,
              overlays,
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
        const categoryOverlays = loadOverlays(category);
        await this.login();
        await this.assertOverlaysNotDropped(
          category.name,
          categoryOverlays,
          {categoryId: category.name},
        );
        const createdCategorySpec = await this.request.post(`api/specs`, {
          environmentId: this.config.environment,
          categoryId: category.name,
          spec: parsedSwagger,
          latest: true,
        });

        // `POST /api/specs` is the generated CRUD route and does not accept
        // overlays inline, so category overlays go up separately.
        if (categoryOverlays.length > 0) {
          const categorySpecId = createdCategorySpec?.data?.id;
          if (!categorySpecId) {
            throw new Error(
              `Cannot upload overlays for category ${category.name}: no spec id returned`,
            );
          }
          console.log(
            `Uploading ${categoryOverlays.length} overlay(s) for category ${category.name}`,
          );
          try {
            await this.request.put(`api/specs/${categorySpecId}/overlays`, {
              overlays: categoryOverlays,
            });
          } catch (error) {
            console.log(
              `Failed to upload overlays for category ${category.name}`,
            );
            try {
              await this.request.delete(`api/specs/${categorySpecId}`);
            } catch (cleanupError) {
              console.log(
                `Failed to roll back category spec ${categorySpecId}: ${
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError)
                }`,
              );
            }
            throw error;
          }
        }

        return Promise.all(
          category.products.map(async product => {
            console.log(`Uploading ${product.name}`);
            let parsedSwagger;
            let overlays = [];
            if (product.inheritSpec === false) {
              if (!product.openapi) {
                console.log('You have to specify spec');
                return;
              }
              parsedSwagger = await this.readSwaggerFile(product.openapi);
              await SwaggerParser.validate(product.openapi);
              // Products that inherit the category spec use the category's
              // overlays, so only own-spec products carry their own.
              overlays = loadOverlays(product);
              if (!this.config.token) {
                await this.login();
              }
              await this.assertOverlaysNotDropped(product.name, overlays);
            } else if (
              Array.isArray(product.overlays) &&
              product.overlays.length > 0
            ) {
              console.log(
                `Ignoring overlays for ${product.name}: it inherits the category spec, so declare the overlays on category "${category.name}" instead`,
              );
            }
            return this.request
              .post(
                `${this.apiproductSpecsPath(product.name)}${
                  this.config.force ? '?force=true' : ''
                }`,
                {
                  spec: parsedSwagger,
                  categoryId: category.name,
                  inheritSpec: product.inheritSpec,
                  permissiongroup: product.permissionGroup,
                  latest: true,
                  overlays,
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

          if (result?.status !== 200 || !result?.data?.id) {
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
                      `Failed to add permission group ${permissionGroup}: ${formatRequestError(
                        permError,
                      )}`,
                    ); // Continue with other permission groups instead of throwing
                  }
                }),
              );
            } catch (permGroupsError) {
              console.log(
                `Failed to retrieve permission groups for team ${team.name}: ${formatRequestError(
                  permGroupsError,
                )}`,
              ); // Continue with next team via early return
              return;
            }
          }
        } catch (teamError) {
          console.log(
            `Error processing team ${team.name}: ${formatRequestError(
              teamError,
            )}`,
          ); // Continue with next team via early return
          return;
        }
      }),
    );
  }

  async pushBackendTeams() {
    if (!this.backendTeamConfig || this.backendTeamConfig.length === 0) {
      return;
    }
    return Promise.all(
      this.backendTeamConfig.map(async team => {
        if (!this.config.token) {
          await this.login();
        }

        let teamId;
        try {
          const teamsResponse = await this.request.get(`api/teams`);

          const existingTeam = teamsResponse.data.find(
            t => t.name === team.name,
          );

          let result;
          if (existingTeam) {
            if (existingTeam.teamType !== 'backend') {
              throw new Error(
                `Backend team "${team.name}" conflicts with existing team "${team.name}" whose teamType is ${
                  existingTeam.teamType || 'normal'
                }, not backend`,
              );
            }
            console.log(
              `Backend team ${team.name} already exists, using existing team ID: ${existingTeam.id}`,
            );
            result = {status: 200, data: existingTeam};
          } else {
            console.log(`Creating backend team ${team.name}`);
            const developerQuery =
              team.owner != null && team.owner !== ''
                ? `?developerId=${encodeURIComponent(team.owner)}`
                : '';
            result = await this.request.post(`api/teams${developerQuery}`, {
              name: team.name,
              teamType: 'backend',
            });
          }

          if (result?.status !== 200 || !result?.data?.id) {
            throw new Error(
              `Unexpected response creating backend team ${team.name}`,
            );
          }

          teamId = result.data.id;
          console.log(`Backend team ID: ${teamId}`);

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
                      `Permission group ${permissionGroup} already exists for backend team ${team.name}, skipping`,
                    );
                    return;
                  }

                  console.log(`Adding permission group ${permissionGroup}`);
                  try {
                    await this.request.post(
                      `api/teams/${teamId}/permissiongroups`,
                      {
                        name: permissionGroup,
                      },
                    );
                  } catch (permError) {
                    console.log(
                      `Failed to add permission group ${permissionGroup}: ${formatRequestError(
                        permError,
                      )}`,
                    );
                  }
                }),
              );
            } catch (permGroupsError) {
              console.log(
                `Failed to retrieve permission groups for backend team ${team.name}: ${formatRequestError(
                  permGroupsError,
                )}`,
              );
              return;
            }
          }
        } catch (teamError) {
          throw new Error(
            `Error processing backend team ${team.name}: ${formatRequestError(
              teamError,
            )}`,
          );
        }
      }),
    );
  }

  async assignBackendTeamsFromManifest() {
    if (
      !this.backendTeamAssignments ||
      this.backendTeamAssignments.length === 0
    ) {
      return;
    }
    if (!this.config.environment) {
      throw new Error(
        'Missing environment id — backend team assignment requires --environment',
      );
    }
    if (!this.config.token) {
      await this.login();
    }

    const teamsResponse = await this.request.get(`api/teams`);
    const teams = teamsResponse.data || [];

    for (const assignment of this.backendTeamAssignments) {
      const {productName, backendTeam} = assignment;

      if (backendTeam === null) {
        await this.request.post(
          `api/environments/${encodeURIComponent(this.config.environment)}/apiproducts/${encodeURIComponent(
            productName,
          )}/assign-backend-team`,
          {backendTeamId: null},
        );
        console.log(`Unassigned backend team for API product ${productName}`);
        continue;
      }

      if (
        typeof backendTeam !== 'string' ||
        (backendTeam.trim && backendTeam.trim() === '')
      ) {
        throw new Error(
          `Invalid backendTeam for API product "${productName}": expected a non-empty string or null (YAML ~) to unassign`,
        );
      }

      const match = teams.find(
        t => t.name === backendTeam && t.teamType === 'backend',
      );

      if (!match) {
        const wrongType = teams.find(t => t.name === backendTeam);
        if (wrongType) {
          throw new Error(
            `Cannot assign backend team "${backendTeam}" to API product "${productName}": a team with that name exists but teamType is ${
              wrongType.teamType || 'normal'
            }, not backend`,
          );
        }
        throw new Error(
          `Cannot assign backend team to API product "${productName}": no backend team named "${backendTeam}" found (declare it under backendTeams in the manifest first)`,
        );
      }

      await this.request.post(
        `api/environments/${encodeURIComponent(this.config.environment)}/apiproducts/${encodeURIComponent(
          productName,
        )}/assign-backend-team`,
        {backendTeamId: match.id},
      );
      console.log(
        `Assigned backend team ${backendTeam} to API product ${productName}`,
      );
    }
  }

  async listApiproducts() {
    if (!this.config.token) {
      await this.login();
    }
    const response = await this.request.get(
      `api/environments/${encodeURIComponent(
        this.config.environment,
      )}/apiproducts`,
    );
    const data = response && response.data;
    return Array.isArray(data) ? data : [];
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
      this.markdownUploadUrl(),
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
