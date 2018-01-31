const tress = require('tress');
const needle = require('needle');
const cheerio = require('cheerio');
const resolve = require('url').resolve;
const randomUseragent = require('random-useragent');
const utils = require('./utils');

let results = [];
let url = 'http://irby.kz/ru/';

const formatUrl = id => `http://irby.kz/ru/api/?controller=RequestHandlerProduct&action=Product&product=${id}`;

const jquery = body => cheerio.load(body);

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