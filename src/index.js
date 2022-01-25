#!/usr/bin/env node
const program = require('commander')
const {version, name, description} = require('../package.json')
const Portal = require('./devportal/portal')
const Marketplace = require('./devportal/module/marketplace')
const archiver = require('archiver')
const streamToPromise = require('stream-to-promise')

program.name(name)
    .version(version, '-v, --version')
    .description(description)

program.command('upload-spec <manifest>')
    .requiredOption('--environment <environment>', 'add the environment to deploy this to', process.env.APIDEX_ENVIRONMENT)
    .requiredOption('--host <host>', 'add the hostname for the developer portal', process.env.APIDEX_HOST)
    .requiredOption('--clientId <clientId>', 'add the clientId from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_CLIENTID)
    .option('--clientSecret <clientSecret>', 'add the clientSecret from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_SECRET)
    .option('--aud <aud>', 'Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token.', null)
    .requiredOption('--scope <scope>', 'add the scope for the developer portal app registration', process.env.APIDEX_SCOPE)
    .requiredOption('--tokenUrl <tokenUrl>', 'add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)', process.env.APIDEX_TOKENURL)
    .option('--force', 'Force the database to overwrite spec regardless of version number', false)
    .description('uploads an openapi spec to apidex')
    .action((manifest, command) => {
        const config = {
            environment: command.environment,
            clientId: command.clientId,
            clientSecret: command.clientSecret,
            aud: command.aud,
            hostname: command.host,
            scope: command.scope,
            tokenUrl: command.tokenUrl,
            grantType: 'client_credentials',
            force: command.force
        }

        try {
            const portal = new Portal(config, manifest)

            portal.pushSwagger().then(success => {
                console.log('Successfully updated documentation')
            }).catch(error => {
                console.log(error.response ? error.response.data : error)
                process.exit(1)
            })
        } catch (e) {
            console.log(e.message)
        }
    })

program.command('upload-markdown <directory>')
    .requiredOption('--host <host>', 'add the hostname for the developer portal', process.env.APIDEX_HOST)
    .requiredOption('--clientId <clientId>', 'add the clientId from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_CLIENTID)
    .option('--clientSecret <clientSecret>', 'add the clientSecret from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_SECRET)
    .option('--aud <aud>', 'Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token.', null)
    .requiredOption('--scope <scope>', 'add the scope for the developer portal app registration', process.env.APIDEX_SCOPE)
    .requiredOption('--tokenUrl <tokenUrl>', 'add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)', process.env.APIDEX_TOKENURL)
    .description('uploads a directory of markdown files to apidex')
    .action(async (directory, command) => {
        const config = {
            clientId: command.clientId,
            clientSecret: command.clientSecret,
            aud: command.aud,
            hostname: command.host,
            scope: command.scope,
            tokenUrl: command.tokenUrl,
            grantType: 'client_credentials'
        }

        const portal = new Portal(config)

        let archive = archiver('zip')
        archive.directory(directory, false)
        archive.finalize()

        const done = await streamToPromise(archive)

        portal.pushMarkdown(done).then(() => console.log('Successfully pushed markdown to developer portal')).catch(error => {
            console.log(error)
            process.exit(1)
        })
    })

program.command('module-marketplace <manifest>')
    .requiredOption('--environment <environment>', 'add the environment to deploy this to', process.env.APIDEX_ENVIRONMENT)
    .requiredOption('--host <host>', 'add the hostname for the developer portal', process.env.APIDEX_HOST)
    .requiredOption('--marketplaceHost <marketplaceHost>', 'add the hostname for the marketplace', process.env.APIDEX_MARKETPLACE_HOST)
    .option('--clientId <clientId>', 'add the clientId from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_CLIENTID)
    .option('--clientSecret <clientSecret>', 'add the clientSecret from your OpenID Connect provider linked to the developer portal', process.env.APIDEX_SECRET)
    .option('--aud <aud>', 'Only used in combination with client certificate authentication instead of clientSecret. Provide the audience for the client token.', null)
    .option('--scope <scope>', 'add the scope for the developer portal app registration', process.env.APIDEX_SCOPE)
    .option('--tokenUrl <tokenUrl>', 'add the tokenUrl from your OpenID Connect provider (ex: https://login.microsoftonline.com/yourcompany.onmicrosoft.com/oauth2/v2.0/token)', process.env.APIDEX_TOKENURL)
    .option('--token <token>', 'provide a token instead', process.env.APIDEX_TOKEN)
    .description('adds a product to the marketplace, after it is published to apidex')
    .action(async (manifest, command) => {
        const config = {
            environment: command.environment,
            clientId: command.clientId,
            clientSecret: command.clientSecret,
            aud: command.aud,
            hostname: command.host,
            marketplaceHostname: command.marketplaceHost,
            scope: command.scope,
            tokenUrl: command.tokenUrl,
            token: command.token,
            grantType: 'client_credentials'
        }

        const portal = new Portal(config, manifest)

        const products = await portal.getProducts()
        const marketplace = new Marketplace(config)
        const all = await Promise.all(products.map(product => marketplace.pushProduct(product)))
        console.log('Succesfully pushed products to marketplace: ' + JSON.stringify(products.map(product => products.name)))
    })

program.parse(process.argv)
