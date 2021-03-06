#!/usr/bin/env node
const Apiproduct = require('./models/apiproduct')
const Apiproxy = require('./models/api-proxy')
const yaml = require('js-yaml')
const fs = require('fs')

const isUpdated = (a, b, properties) => {
  return properties.find(prop => {
    if (prop.includes('.')) {
      const props = prop.split('.')
      return a[props[0]][props[1]] !== b[props[0]][props[1]]
    }
    return a[prop] !== b[prop]
  })
}

module.exports = async (config, manifest) => {
  const productModel = new Apiproduct(config)
  const proxyModel = new Apiproxy(config)
  let yml = yaml.load(fs.readFileSync(manifest, 'utf8'))
  const productConfig = yml.products
  if (!productConfig) {
    return false
  }
  productConfig.map(async (product) => {
    const newProduct = {
      isPublished: true,
      status_code: 'PUBLISHED',
      isRestricted: false,
      description: product.description,
      title: product.title || product.name,
      name: product.name,
      apiProxies: product.proxies.map((proxy) => ({__metadata: {uri: `APIProxies(name='${proxy}')`}})),
      quotaCount: product.quota || null,
      quotaInterval: product.interval || null,
      quotaTimeUnit: product.timeunit || null,
      scope: product.scopes ? product.scopes.join(',') : ''
    }

    try {
      const current = await productModel.findById(product.name)
      const currentProduct = JSON.parse(current.body)
      const add = product.proxies.filter(proxy => !currentProduct.d.apiProxies.results.find(res => res.name === proxy))
      const actualAdd = []
      for(const index in add){
        await proxyModel.findById(add[index]).then(() => actualAdd.push(add[index])).catch(e => {
          console.log(`proxy ${add[index]} does not exist.`)
        })
      }
      const remove = currentProduct.d.apiProxies.results.filter(res => !product.proxies.find(proxy => res.name === proxy)).map(res => res.name)
      if (actualAdd.length > 0 || remove.length > 0 || isUpdated(currentProduct.d, newProduct, ['description', 'title', 'quotaCount', 'quotaInterval', 'quotaTimeUnit', 'scope'])) {
        const errors = await productModel.update(newProduct, product.name, actualAdd, remove)
        errors.forEach(response => {
          if (response.error) {
            console.error(response.error.message.value)
            process.exitCode = 1;
          }
        })
        if (errors.length === 0) {
          console.log('Product updated: '+ newProduct.name)
        }
      } else {
        console.log('Product up to date: '+ newProduct.name)
      }
    } catch (e) {
      if (e.message.includes('not be found')) {
        const response = await productModel.create(newProduct)
        const body = JSON.parse(response.body)
        if (body.error) {
          console.error(body.error.message.value)
          process.exitCode = 1;
        } else {
          console.log('Created product: '+ newProduct.name)
        }
      } else {
        console.log(e.message)
        process.exitCode = 1
      }
    }
  })
}
