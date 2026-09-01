#!/usr/bin/env node
const program = require('commander');
const {version, name, description} = require('../package.json');
const Portal = require('./devportal/portal');
const archiver = require('archiver');
const streamToPromise = require('stream-to-promise');
const {runUploadSpecCli} = require('./commands/upload-spec');
const {runUploadMarkdownCli} = require('./commands/upload-markdown');
const {runValidateCli} = require('./commands/validate');

function createProgram() {
  const cli = program.createCommand();

  cli.name(name).version(version, '-v, --version').description(description);

  cli
    .command('upload-spec <manifest>')
    .requiredOption(
      '--environment <environment>',
      'add the environment to deploy this to',
      process.env.APIDEX_ENVIRONMENT,
    )
    .requiredOption(
      '--host <host>',
      'add the hostname for the developer portal',
      process.env.APIDEX_HOST,
    )
    .option(
      '--clientId <clientId>',
      'add the clientId from your OpenID Connect provider linked to the developer portal',
      process.env.APIDEX_CLIENTID,
    )
    .option(
      '--clientSecret <clientSecret>',
      'add the clientSecret from your OpenID Connect provider linked to the developer portal',
      process.env.APIDEX_SECRET,
    )
    .option(
      '--aud <aud>',
      'Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token.',
      null,
    )
    .option(
      '--scope <scope>',
      'add the scope for the developer portal app registration',
      process.env.APIDEX_SCOPE,
    )
    .option(
      '--tokenUrl <tokenUrl>',
      'add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)',
      process.env.APIDEX_TOKENURL,
    )
    .option(
      '--force',
      'Force the database to overwrite spec regardless of version number',
      false,
    )
    .option(
      '--token <token>',
      'provide a token instead',
      process.env.APIDEX_TOKEN,
    )
    .description('uploads an openapi spec to apidex')
    .action(async (manifest, command) => {
      const config = {
        environment: command.environment,
        clientId: command.clientId,
        clientSecret: command.clientSecret,
        aud: command.aud,
        hostname: command.host,
        scope: command.scope,
        tokenUrl: command.tokenUrl,
        grantType: 'client_credentials',
        force: command.force,
        token: command.token,
      };

      try {
        const portal = new Portal(config, manifest);
        await runUploadSpecCli(portal);
      } catch (e) {
        console.log(e.message);
        process.exit(1);
      }
    });

  cli
    .command('validate [manifest]')
    .option(
      '--require-locales <list>',
      'comma-separated locales every non-inherited spec must declare overlays for',
    )
    .option(
      '--host <host>',
      'portal hostname (or APIDEX_HOST)',
      process.env.APIDEX_HOST,
    )
    .option(
      '--environment <environment>',
      'portal environment id (or APIDEX_ENVIRONMENT)',
      process.env.APIDEX_ENVIRONMENT,
    )
    .option(
      '--token <token>',
      'portal token (or APIDEX_TOKEN)',
      process.env.APIDEX_TOKEN,
    )
    .description(
      'validate OpenAPI overlay files and that manifest API products exist in the portal',
    )
    .action(async (manifest, command) => {
      await runValidateCli({
        manifestPath: manifest,
        requireLocales: command.requireLocales,
        host: command.host,
        environment: command.environment,
        token: command.token,
      });
    });

  cli
    .command('upload-markdown <directory>')
    .requiredOption(
      '--host <host>',
      'add the hostname for the developer portal',
      process.env.APIDEX_HOST,
    )
    .requiredOption(
      '--clientId <clientId>',
      'add the clientId from your OpenID Connect provider linked to the developer portal',
      process.env.APIDEX_CLIENTID,
    )
    .option(
      '--clientSecret <clientSecret>',
      'add the clientSecret from your OpenID Connect provider linked to the developer portal',
      process.env.APIDEX_SECRET,
    )
    .option(
      '--aud <aud>',
      'Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token.',
      null,
    )
    .requiredOption(
      '--scope <scope>',
      'add the scope for the developer portal app registration',
      process.env.APIDEX_SCOPE,
    )
    .requiredOption(
      '--tokenUrl <tokenUrl>',
      'add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)',
      process.env.APIDEX_TOKENURL,
    )
    .description('uploads a directory of markdown files to apidex')
    .action(async (directory, command) => {
      const config = {
        clientId: command.clientId,
        clientSecret: command.clientSecret,
        aud: command.aud,
        hostname: command.host,
        scope: command.scope,
        tokenUrl: command.tokenUrl,
        grantType: 'client_credentials',
      };

      const portal = new Portal(config);

      let archive = archiver('zip');
      archive.directory(directory, false);
      archive.finalize();

      const done = await streamToPromise(archive);

      await runUploadMarkdownCli(portal, done);
    });

  return cli;
}

/* istanbul ignore next */
if (require.main === module) {
  createProgram().parse(process.argv);
}

module.exports = {createProgram};
