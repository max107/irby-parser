const tress = require('tress');
const needle = require('needle');
const cheerio = require('cheerio');
const resolve = require('url').resolve;
const randomUseragent = require('random-useragent');
const fs = require('fs');
const json2csv = require('json2csv');
const Iconv  = require('iconv').Iconv;

let results = [];
let url = 'http://irby.kz/ru/';

const formatUrl = id => `http://irby.kz/ru/api/?controller=RequestHandlerProduct&action=Product&product=${id}`;

const jquery = body => cheerio.load(body);

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
            article: item.article,
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
        let content = json2csv({
            data: products,
            fields: Object.keys(products[0])
        });
        let iconv = new Iconv('UTF-8', 'cp1251');

        fs.writeFileSync(path, iconv.convert(content));
    }
}

let q = tress((job, callback) => {
    console.log(job.url);

    needle.get(job.url, { user_agent: randomUseragent.getRandom() }, (err, res) => {
        if (err) {
            console.log(err);
            throw err;
        }

        let $ = jquery(res.body);

        $('[data-product]').each((i, item) => {
            let $product = $(item),
                id = $product.attr('data-product'),
                href = $product.find('.produkts-item-fast-view-content a.btn.btn-primary').attr('href');

            if (!href) {
                return;
            }

            results.push({
                id,
                href,
            });

            q.push({
                url: resolve(url, href),
                callback: (err, res) => {
                    let $ = jquery(res.body);

                    let bc = [];
                    $('.breadcrumb li').each((i, el) => {
                        bc.push($(el).text());
                    });
                    let index = results.findIndex(obj => obj.id === id);
                    results[index] = Object.assign(results[index], {
                        breadcrumbs: bc.join(' / ')
                    });
                }
            });

            q.push({
                url: formatUrl(id),
                callback: (err, res) => {
                    let index = results.findIndex(obj => obj.id === id);
                    results[index] = Object.assign(
                        results[index],
                        JSON.parse(res.body)
                    );
                }
            });
        });

        if (job.callback) {
            job.callback(err, res);
        }

        callback();
    });
}, 12);

q.drain = () => {
    utils.save('./data.csv', utils.prepare(results));
};

q.push({
    url: 'http://irby.kz/ru/catalog/dlya_devochek/?SHOW_ALL=Y'
});

q.push({
    url: 'http://irby.kz/ru/catalog/dlya_malchikov_1/?SHOW_ALL=Y'
});