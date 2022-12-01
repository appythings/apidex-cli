const axios = require('axios')
const qs = require('qs')
const SwaggerParser = require("@apidevtools/swagger-parser");
const yaml = require('js-yaml')
const fs = require('fs-extra')
const FormData = require('form-data')
const jwt = require('../lib/jwt')

class Portal {
    constructor(config, manifest) {
        if(manifest){
            let yml = yaml.load(fs.readFileSync(manifest, 'utf8'))
            const productConfig = yml.products
            this.categories = yml.categories
            if ((!productConfig || !productConfig.find(product => product.openapi)) && !this.categories) {
                throw new Error('no product found to upload')
            }
            if(productConfig){
                this.swaggerFiles = productConfig.filter(product => product.openapi)
            }
        }
        this.config = config
        this.request = axios.create({
            baseURL: this.config.hostname,
            timeout: 60000,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }
        })
        if(config.token){
            this.request.defaults.headers.common['Authorization'] = 'Bearer ' + config.token
        }
    }

    async login() {
        if(this.request.defaults.headers.common['Authorization']){
            return
        }
        const data = {
            'client_id': this.config.clientId,
            'client_secret': this.config.clientSecret,
            'grant_type': this.config.grantType,
            'scope': this.config.scope
        }
        if (process.env.PRIVATE_KEY_BASE64 && process.env.PUBLIC_KEY_BASE64) {
            const privateKey = Buffer.from(process.env.PRIVATE_KEY_BASE64, 'base64')
                .toString('utf8');
            const publicKey = Buffer.from(process.env.PUBLIC_KEY_BASE64, 'base64')
                .toString('utf8');
            data.client_assertion = jwt.create(this.config.clientId, privateKey,
                publicKey, this.config.aud);
            data.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
        }
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: qs.stringify(data),
            url: this.config.tokenUrl
        }
        const response = await axios(options)
        this.request.defaults.headers.common['Authorization'] = 'Bearer ' + response.data.access_token
    }

    readSwaggerFile(spec) {
        const swagger = fs.readFileSync(spec, 'utf8')

        if (spec.endsWith('.yml') || spec.endsWith('.yaml')) {
            return yaml.load(swagger)
        }
        if (spec.endsWith('.json')) {
            return JSON.parse(swagger)
        }
        throw new Error('Openapi spec must be either yaml/yml or json')
    }

    async pushSwagger() {
        if(!this.swaggerFiles){
            return
        }
        return Promise.all(this.swaggerFiles.map(async product => {
            console.log(`Uploading ${product.openapi} for product: ${product.name}`)
            const parsedSwagger = await this.readSwaggerFile(product.openapi)
            await SwaggerParser.validate(product.openapi);
            if(!this.config.token){
                await this.login()
            }
            const params = new URLSearchParams('');
            if (this.config.force) params.append('force', 'true')
            if (product.permissionGroup) params.append('permissiongroup', `${product.permissionGroup}`)
            return this.request.post(`api/environments/${this.config.environment}/apiproducts/${product.name}/specs${params.toString() ? `?${params.toString()}` : ''}`, {
                spec: parsedSwagger,
                inheritSpec: false,
            })
        }))
    }

    async pushCategories() {
        if(!this.categories){
            return
        }
        return Promise.all(this.categories.map(async category => {
            console.log(`Uploading ${category.name}`)
            const parsedSwagger = await this.readSwaggerFile(category.openapi)
            await SwaggerParser.validate(category.openapi);
            await this.login()
            await this.request.post(`api/environments/${this.config.environment}/specs`, {
                categoryId: category.name,
                spec: parsedSwagger
            });

            return Promise.all(category.products.map(async product => {
                    console.log(`Uploading ${product.name}`)
                    let parsedSwagger
                    if (product.inheritSpec === false) {
                        if (!product.openapi) {
                            console.log('You have to specify spec')
                            return
                        }
                        parsedSwagger = await this.readSwaggerFile(product.openapi)
                        await SwaggerParser.validate(product.openapi);
                    }
                    const params = new URLSearchParams('');
                    if (this.config.force) params.append('force', 'true')
                    if (product.permissionGroup) params.append('permissiongroup', `${product.permissionGroup}`)
                    return this.request.post(`api/environments/${this.config.environment}/apiproducts/${product.name}/specs${params.toString() ? `?${params.toString()}` : ''}`, {
                        spec: parsedSwagger,
                        categoryId: category.name,
                        inheritSpec: product.inheritSpec,
                    })
                }
            ))
        }))
    }

    async getProducts() {
        const products = await this.request.get(`api/environments/${this.config.environment}/apiproducts`)
        return products.data.filter(product => this.swaggerFiles.find(swaggerFileProduct => swaggerFileProduct.name === product.name))
    }

    async pushMarkdown(zipFile) {
        if(!this.config.token){
            await this.login()
        }
        const form = new FormData()
        form.append('zip', zipFile, {
            filename: 'markdown.zip'
        })
        return axios.post(`https://${this.config.hostname}/markdown`,
            form.getBuffer(),
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: this.request.defaults.headers.common['Authorization']
                }
            })
    }
}

module.exports = Portal
