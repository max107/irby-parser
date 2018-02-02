const tress = require('tress');
const needle = require('needle');
const striptags = require('striptags');
const cheerio = require('cheerio');
const resolve = require('url').resolve;
const randomUseragent = require('random-useragent');
const fs = require('fs');
const json2csv = require('json2csv');
const Iconv = require('iconv').Iconv;

let results = [];
let url = 'http://irby.kz/ru/';

const formatUrl = id => `http://irby.kz/ru/api/?controller=RequestHandlerProduct&action=Product&product=${id}`;

const jquery = body => cheerio.load(body);

function prepareOptions(v) {
    return v.options.map(o => o.option);
}

function prepare(items) {
    let products = [];

    for (let i = 0; i < items.length; i++) {
        let item = items[i];

        const colorVariants = item.variants.filter(v => v.color);
        const sizeVariants = item.variants.filter(v => !v.color);
        let colors = [];
        let sizes = [];
        for (let z = 0; z < colorVariants.length; z++) {
            colors = colors.concat(prepareOptions(colorVariants[z]));
        }
        for (let z = 0; z < sizeVariants.length; z++) {
            sizes = sizes.concat(prepareOptions(sizeVariants[z]));
        }

        let product = {
            article: item.article,
            name: item.name,
            price_current: item.price.current,
            price: item.price.price,
            description: striptags(item.description),
            season: item.season,
            id: item.product,
            quantity: item.quantity,
            category: item.category,
            breadcrumbs: item.breadcrumbs,
            url: resolve(url, item.href),
            images: (item.images || []).map(image => resolve(url, image.large)).join(','),
        };

        for (let m = 0; m < colors.length; m++) {
            let variant = {
                ...product,
                color: colors[m].trim()
            };

            for (let x = 0; x < sizes.length; x++) {
                variant = {
                    ...variant,
                    size: sizes[x]
                };

                products.push(variant);
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

function parse() {

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
                            breadcrumbs: bc.slice(2, bc.length - 1).join(' / ')
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
    }, 6);

    q.drain = () => {
        fs.writeFileSync('./data.json', JSON.stringify(results, null, 4));
        save('./data.csv', prepare(results));
    };

    q.push({
        url: 'http://irby.kz/ru/catalog/dlya_devochek/?SHOW_ALL=Y'
    });

    q.push({
        url: 'http://irby.kz/ru/catalog/dlya_malchikov_1/?SHOW_ALL=Y'
    });

}

function read() {
    fs.readFile('./data.json', 'utf8', (err, contents) => {
        save('./data.csv', prepare(JSON.parse(contents)));
    });
}

// read();

parse();