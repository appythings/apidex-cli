const axios = require('axios')

class Marketplace {
    constructor(config) {
        this.config = config
        this.request = axios.create({
            baseURL: this.config.marketplaceHostname,
            timeout: 60000,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + config.token
            }
        })
    }

    async pushProduct(product) {
        return this.request.post(`/api/api-dex/product`, { ...product, id: product.name, url: `${this.config.hostname}/products/${product.name}`})
    }
}

module.exports = Marketplace
