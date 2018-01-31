const fs = require('fs');
const json2csv = require('json2csv');

function getAllStoreIds(items) {
    let ids = [];

    for (let i = 0; i < items.length; i++) {
        let item = items[i];

        for (let v = 0; v < item.variants.length; v++) {
            let variant = item.variants[v];
            for (let t = 0; t < variant.options.length; t++) {
                let option = variant.options[t];

                for (let s = 0; s < option.stores.length; s++) {
                    ids.push(option.stores[s].id);
                }
            }
        }
    }

    return ids.filter((v, i, a) => a.indexOf(v) === i)
}

function prepare(items) {
    let products = [],
        storeIds = getAllStoreIds(items);

    for (let i = 0; i < items.length; i++) {
        let item = items[i],
            cartesian = [];

        for (let v = 0; v < item.variants.length; v++) {
            let variant = item.variants[v],
                variantName = variant.color ? 'color' : 'size',
                parameters = [];

            for (let t = 0; t < variant.options.length; t++) {
                let option = variant.options[t],
                    part = {
                        type: variantName,
                        [variantName]: option.option,
                    };

                for (let j = 0; j < storeIds.length; j++) {
                    let id = storeIds[j],
                        store = option.stores.find(store => store.id === id) || {
                            amount: '',
                            name: ''
                        };

                    part = Object.assign(part, {
                        [`store_${id}_${variantName}_amount`]: store.amount,
                        [`store_${id}_${variantName}_name`]: store.name,
                    });
                }

                parameters.push(part);
            }

            cartesian.push(parameters);
        }

        const [colors, sizes] = cartesian;

        let product = {
            name: item.name,
            price_current: item.price.current,
            price: item.price.price,
            description: item.description,
            season: item.season,
            id: item.product,
            quantity: item.quantity,
            category: item.category,
            breadcrumbs: item.breadcrumbs,
            url: item.href,
            images: (item.images || []).map(image => image.large).join(','),
        };

        for (let m = 0; m < colors.length; m++) {
            let variant = Object.assign(product, colors[m]);

            for (let x = 0; x < sizes.length; x++) {
                let result = Object.assign(variant, sizes[x]);
                delete result.type;

                products.push(result);
            }
        }
    }

    return products;
}

function save(path, products) {
    if (products.length > 0) {
        fs.writeFileSync(path, json2csv({
            data: products,
            fields: Object.keys(products[0])
        }));
    }
}

module.exports = {
    prepare,
    save
};