#!/usr/bin/env node
const program = require('commander');
const {version, name, description} = require('../package.json');
const Portal = require('./devportal/portal');
const archiver = require('archiver');
const streamToPromise = require('stream-to-promise');
const {runUploadSpecCli} = require('./commands/upload-spec');
const {runUploadMarkdownCli} = require('./commands/upload-markdown');
const {runValidateCli} = require('./commands/validate');
const {runAddDocCli} = require('./commands/add-doc');

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
      '--skip-docs',
      'Skip pushing product docs tabs to Payload',
      false,
    )
    .option(
      '--force-docs',
      'Overwrite CMS docs tabs even if they were edited in the admin UI',
      false,
    )
    .option(
      '--token <token>',
      'provide a token instead',
      process.env.APIDEX_TOKEN,
    )
    .description('uploads OpenAPI or MCP specs to apidex')
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
        skipDocs: command.skipDocs,
        forceDocs: command.forceDocs,
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
      '--check-portal',
      'also check that manifest product names exist in the portal (requires --host, --environment, and a token)',
      false,
    )
    .option('--json', 'print check results as JSON', false)
    .description(
      'validate OpenAPI and MCP specs, overlay files, manifest paths, and markdown links (use --check-portal to match products in the portal)',
    )
    .action(async (manifest, command) => {
      await runValidateCli({
        manifestPath: manifest,
        requireLocales: command.requireLocales,
        host: command.host,
        environment: command.environment,
        token: command.token,
        clientId: command.clientId,
        clientSecret: command.clientSecret,
        aud: command.aud,
        scope: command.scope,
        tokenUrl: command.tokenUrl,
        checkPortal: command.checkPortal,
        json: command.json,
      });
    });

  cli
    .command('manifest')
    .description('edit the spec-repo manifest')
    .command('add-doc <product> <markdown>')
    .requiredOption('--manifest <file>', 'path to apis.yaml')
    .option('--title <title>', 'tab title (default: first markdown H1)')
    .option('--slug <slug>', 'tab slug (default: markdown filename)')
    .option('--locale <locale>', 'attach a translation to an existing --slug')
    .option('--update', 'replace an existing docs entry with the same slug', false)
    .description('add a product docs tab to the manifest (flags only, no wizard)')
    .action((product, markdown, command) => {
      runAddDocCli({
        product,
        markdown,
        manifest: command.manifest,
        title: command.title,
        slug: command.slug,
        locale: command.locale,
        update: command.update,
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
