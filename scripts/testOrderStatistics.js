const assert = require('assert');
const {
    ORDER_STATUSES,
    resolveDateRange,
    fillStatusCounts,
    fillMonthlySeries,
    msToDays,
    getOrderStatistics
} = require('../services/orderStatistics');

function ok(cond, msg) {
    assert(cond, msg);
    console.log('OK:', msg);
}

ok(ORDER_STATUSES.includes('DONE'), 'DONE is a known status');
ok(ORDER_STATUSES.length === 7, 'all internal statuses present');

let threw = false;
try {
    resolveDateRange('week');
} catch (err) {
    threw = err.status === 400;
}
ok(threw, 'invalid period → 400');

const now = new Date('2026-09-12T10:00:00.000Z');
const month = resolveDateRange('month', now);
ok(month.from instanceof Date, 'month has from');
ok(month.previousFrom instanceof Date, 'month has previousFrom');
ok(month.previousTo.getTime() === month.from.getTime(), 'previous month ends at current start');

const all = resolveDateRange('all', now);
ok(all.from === null, 'all has no from');
ok(all.previousFrom === null, 'all has no previous range');

const filled = fillStatusCounts([{ _id: 'DONE', count: 4 }, { _id: 'new', count: 2 }]);
ok(filled.length === 7, 'status series includes zeros');
ok(filled.find((s) => s.status === 'DONE').count === 4, 'DONE count kept');
ok(filled.find((s) => s.status === 'delayed').count === 0, 'missing status is 0');

ok(msToDays(4.2 * 24 * 60 * 60 * 1000) === 4.2, 'msToDays rounds to 1 decimal');

const series = fillMonthlySeries(
    [{ _id: '2026-08', count: 3 }],
    new Date('2026-07-01T00:00:00.000Z'),
    new Date('2026-09-01T00:00:00.000Z')
);
ok(series.length >= 2, 'monthly series fills gaps');
ok(series.some((p) => p.yearMonth === '2026-08' && p.count === 3), 'known month kept');
ok(series.some((p) => p.count === 0), 'empty months are 0');

(async () => {
    const mockOrder = {
        aggregate: async (pipeline) => {
            const match = pipeline[0].$match || {};
            if (match.status === 'DONE') {
                return [{ _id: null, count: 2, avgMs: 2 * 24 * 60 * 60 * 1000 }];
            }
            if (pipeline[1] && pipeline[1].$group && pipeline[1].$group._id && pipeline[1].$group._id.$dateToString) {
                return [{ _id: '2026-09', count: 5 }];
            }
            return [{ _id: 'new', count: 5 }];
        }
    };

    const stats = await getOrderStatistics('month', { Order: mockOrder });
    ok(stats.byStatus.find((s) => s.status === 'new').count === 5, 'byStatus uses aggregation');
    ok(stats.overTime.some((p) => p.count === 5), 'overTime uses aggregation');
    ok(stats.completion.averageDays === 2, 'completion averageDays');
    ok(stats.completion.completedCount === 2, 'completion count');
    ok(typeof stats.completion.changeDays === 'number' || stats.completion.changeDays === null, 'changeDays present');

    const fs = require('fs');
    const path = require('path');
    const routes = fs.readFileSync(path.join(__dirname, '../routes/adminRoutes.js'), 'utf8');
    ok(routes.includes("router.get('/statistics'"), 'admin statistics route exists');
    ok(
        routes.includes("authorizeRole(...adminOnly)") &&
            routes.indexOf("router.get('/statistics'") < routes.indexOf("router.get('/orders'"),
        'statistics is registered before orders'
    );

    console.log('\nAll order statistics checks passed.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
