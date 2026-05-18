#!/usr/bin/env node
const program = require('commander');
const {version, name, description} = require('../package.json');
const Portal = require('./devportal/portal');
const archiver = require('archiver');
const streamToPromise = require('stream-to-promise');
const {runUploadSpecCli} = require('./commands/upload-spec');
const {runUploadMarkdownCli} = require('./commands/upload-markdown');

program.name(name).version(version, '-v, --version').description(description);

program
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

program
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

program.parse(process.argv);
